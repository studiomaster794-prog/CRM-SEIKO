import { aplicar, crmVazio, dadosPublicos } from './crm-ops.js'
import { gravarEstado, lerEstado } from './offline-db.js'

let aoSair = () => {}
let aoAvisar = () => {}
const ouvintes = new Set()
let textoAtual = { texto: 'Bem-vindo ao CRM Studio Seiko', pendente: false }

export function setAoSair(fn) {
  aoSair = fn
}

export function setAoAvisar(fn) {
  aoAvisar = fn
}

export function aoMudarRede(fn) {
  ouvintes.add(fn)
  fn(textoAtual)
  return () => ouvintes.delete(fn)
}

function publicar(pendente) {
  textoAtual = pendente
    ? { texto: 'Salvo neste aparelho. Sincroniza quando o computador responder.', pendente: true }
    : { texto: 'Bem-vindo ao CRM Studio Seiko', pendente: false }
  for (const fn of ouvintes) fn(textoAtual)
}

export function lerHub() {
  try {
    const j = JSON.parse(localStorage.getItem('seiko-hub') || '{}')
    return { url: String(j.url || '').trim().replace(/\/$/, ''), token: String(j.token || '').trim() }
  } catch {
    return { url: '', token: '' }
  }
}

export function salvarHub(url, token) {
  const limpo = {
    url: String(url || '').trim().replace(/\/$/, ''),
    token: String(token || '').trim(),
  }
  localStorage.setItem('seiko-hub', JSON.stringify(limpo))
  return limpo
}

function paginaPublica() {
  return location.hostname.endsWith('github.io')
}

function destinoHub() {
  const hub = lerHub()
  if (!hub.url || !/^https?:\/\//i.test(hub.url)) return null
  try {
    if (new URL(hub.url).origin === location.origin) return null
  } catch {
    return null
  }
  return hub
}

let fila = Promise.resolve()
function emFila(fn) {
  const run = fila.then(fn, fn)
  fila = run.then(() => {}, () => {})
  return run
}

async function garantir() {
  const est = (await lerEstado()) || { crm: crmVazio(), outbox: [], sessao: null }
  est.crm = est.crm || crmVazio()
  est.crm.clients ||= []
  est.crm.services ||= []
  est.crm.promissorias ||= []
  est.outbox ||= []
  return est
}

async function gravar(est) {
  await gravarEstado(est)
  publicar(est.outbox.length > 0)
}

function crmDeDados(dados) {
  return {
    clients: dados.clients || [],
    services: dados.services || [],
    promissorias: dados.promissorias || [],
    credor: dados.credor,
    ultimoBackup: dados.ultimoBackup || '',
  }
}

async function tentarRemoto(path, opts = {}) {
  const destinos = [{ base: '', token: '' }]
  const hub = destinoHub()
  if (hub) destinos.push({ base: hub.url, token: hub.token })
  let ultimo = null
  for (const destino of destinos) {
    try {
      const res = await fetch(`${destino.base}${path}`, {
        credentials: destino.base ? 'omit' : 'same-origin',
        headers: {
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
          ...(destino.token ? { 'x-seiko-token': destino.token } : {}),
        },
        method: opts.method || 'GET',
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(4000),
      })
      const text = await res.text()
      let data = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          data = null
        }
      }
      const json = data && typeof data === 'object'
      if (!json) continue
      if (!res.ok) {
        const err = new Error(data?.erro || 'Não foi possível concluir')
        err.status = res.status
        err.data = data
        if (res.status === 400 || res.status === 401 || res.status === 409 || res.status === 404) {
          err.remoto = true
          throw err
        }
        ultimo = err
        continue
      }
      return data
    } catch (err) {
      if (err.remoto) throw err
      ultimo = err
    }
  }
  if (ultimo && !opts.silencioso && ultimo.remoto) throw ultimo
  return null
}

async function enviarOutbox(est) {
  if (!est.outbox.length) return null
  let resp = null
  try {
    resp = await tentarRemoto('/api/sync', { method: 'POST', body: { ops: est.outbox }, silencioso: true })
  } catch (err) {
    if (err.status === 401) {
      aoSair()
      throw err
    }
    return null
  }
  if (!resp) return null
  const aceitos = new Set(resp.aceitos || [])
  const rejeitados = new Map((resp.rejeitados || []).map((item) => [item.id, item]))
  est.outbox = est.outbox.filter((op) => !aceitos.has(op.id) && !rejeitados.has(op.id))
  est.crm = crmDeDados(resp)
  for (const op of est.outbox) aplicar(est.crm, op.method, op.path, op.body || {})
  await gravar(est)
  if (rejeitados.size) {
    const primeiro = resp.rejeitados[0]
    aoAvisar(primeiro?.erro || 'Uma alteração não entrou na sincronização')
  }
  return resp
}

async function mesclarRemoto(est) {
  const dados = await tentarRemoto('/api/data', { silencioso: true })
  if (!dados) return null
  est.crm = crmDeDados(dados)
  for (const op of est.outbox) aplicar(est.crm, op.method, op.path, op.body || {})
  await gravar(est)
  return dadosPublicos(est.crm)
}

function erroLocal(r) {
  const err = new Error(r.data?.erro || 'Não foi possível concluir')
  err.status = r.status
  err.data = r.data
  return err
}

async function aplicarLocal(path, opts) {
  const est = await garantir()
  const method = opts.method || 'POST'
  const body = opts.body ? { ...opts.body } : {}
  if (method === 'POST' && !path.includes('/backup') && !path.endsWith('/reset')) {
    body.id = body.id || globalThis.crypto.randomUUID()
  }
  const r = aplicar(est.crm, method, path, body)
  if (r.status !== 200) throw erroLocal(r)
  est.outbox.push({
    id: globalThis.crypto.randomUUID(),
    em: new Date().toISOString(),
    method,
    path,
    body,
  })
  await gravar(est)
  await enviarOutbox(est)
  return r.data
}

async function sessaoOffline() {
  const est = await garantir()
  if (est.sessao?.nome) {
    return { autenticado: true, precisaConfigurar: false, nome: est.sessao.nome, offline: true }
  }
  if (paginaPublica()) {
    return { autenticado: true, precisaConfigurar: false, nome: 'Seiko', offline: true }
  }
  return { autenticado: false, precisaConfigurar: false, offline: true }
}

async function executar(path, opts = {}) {
  if (path === '/api/me') {
    try {
      const me = await tentarRemoto(path, { silencioso: true })
      if (me) {
        if (me.autenticado) {
          const est = await garantir()
          est.sessao = { nome: me.nome }
          await gravar(est)
        }
        return me
      }
    } catch (err) {
      if (err.status === 401) return { autenticado: false, precisaConfigurar: false }
    }
    return sessaoOffline()
  }

  if (path === '/api/login' || path === '/api/setup') {
    const resposta = await tentarRemoto(path, opts)
    if (!resposta) throw new Error('Sem conexão. A senha só confere com o computador ligado.')
    const est = await garantir()
    est.sessao = { nome: resposta.nome }
    await gravar(est)
    return resposta
  }

  if (path === '/api/logout') {
    try {
      await tentarRemoto(path, { method: 'POST', silencioso: true })
    } catch {
      /* a sessão local sai mesmo sem o servidor */
    }
    const est = await garantir()
    est.sessao = null
    await gravar(est)
    publicar(false)
    return { ok: true }
  }

  const method = opts.method || 'GET'
  const est = await garantir()
  try {
    await enviarOutbox(est)
  } catch (err) {
    if (err.status !== 401) throw err
  }
  if (method === 'GET' && path === '/api/data') {
    const remoto = await mesclarRemoto(est)
    if (remoto) return remoto
    return dadosPublicos(est.crm)
  }
  if (method === 'GET') {
    try {
      const remoto = await tentarRemoto(path, opts)
      if (remoto) return remoto
    } catch (err) {
      if (err.status === 401 && path !== '/api/login' && path !== '/api/setup') aoSair()
      throw err
    }
    throw new Error('Sem conexão com o computador da loja')
  }
  try {
    const remoto = await tentarRemoto(path, opts)
    if (remoto) {
      await mesclarRemoto(est)
      return remoto
    }
  } catch (err) {
    if (err.remoto) {
      if (err.status === 401) aoSair()
      throw err
    }
  }
  return aplicarLocal(path, opts)
}

export async function api(path, opts = {}) {
  return emFila(() => executar(path, opts))
}

export async function sincronizarAgora() {
  return emFila(async () => {
    const est = await garantir()
    await enviarOutbox(est)
    const dados = await mesclarRemoto(est)
    return dados || dadosPublicos(est.crm)
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    sincronizarAgora().catch(() => {})
  })
}
