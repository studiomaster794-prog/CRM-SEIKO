import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createServer as createVite } from 'vite'
import { aplicarOps, dadosPublicos } from './src/crm-ops.js'
import { addDays, digits, formatPhone, hojeISO, isISODate, prazoGarantia } from './src/logic.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(root, 'data')
const authFile = path.join(dataDir, 'auth.json')
const crmFile = path.join(dataDir, 'crm.json')
const syncFile = path.join(dataDir, 'sync.json')
const PORT = Number(process.env.PORT) || 5173

fs.mkdirSync(dataDir, { recursive: true })

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

function writeJson(file, data) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file)
}

function loadAuth() {
  return readJson(authFile, null)
}

function loadCrm() {
  const crm = readJson(crmFile, { clients: [], services: [], promissorias: [] })
  crm.clients ||= []
  crm.services ||= []
  crm.promissorias ||= []
  return crm
}

let fila = Promise.resolve()
function alterarCrm(fn) {
  const run = fila.then(() => {
    const crm = loadCrm()
    const result = fn(crm)
    writeJson(crmFile, crm)
    return result
  })
  fila = run.then(() => {}, () => {})
  return run
}

function hashSenha(senha, salt) {
  return crypto.scryptSync(senha, salt, 32).toString('hex')
}

function senhaConfere(senha, auth) {
  const got = Buffer.from(hashSenha(senha, auth.salt), 'hex')
  const exp = Buffer.from(auth.hash, 'hex')
  return got.length === exp.length && crypto.timingSafeEqual(got, exp)
}

function usuariosDe(auth) {
  if (Array.isArray(auth?.usuarios) && auth.usuarios.length) return auth.usuarios
  if (auth?.hash) return [{ id: 'dono', nome: auth.nome || 'Dono', papel: 'dono', salt: auth.salt, hash: auth.hash }]
  return []
}

function usuarioPorSenha(auth, senha) {
  return usuariosDe(auth).find((usuario) => senhaConfere(senha, usuario)) || null
}

function assinar(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

function abrirToken(token, secret) {
  if (!token || !secret) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const esperado = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(esperado)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (!payload?.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

function cookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=')
    if (i === -1) continue
    out[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim())
  }
  return out
}

function cookieSessao(token) {
  const base = 'seiko=' + (token ? encodeURIComponent(token) : '') + '; HttpOnly; SameSite=Lax; Path=/'
  return token ? `${base}; Max-Age=2592000` : `${base}; Max-Age=0`
}

function limparTexto(v, max) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function limparNota(v, max) {
  return String(v || '').replace(/\r\n/g, '\n').trim().slice(0, max)
}

function loadSync() {
  const salvo = readJson(syncFile, null)
  if (salvo?.token) return salvo
  const criado = { token: crypto.randomBytes(24).toString('hex') }
  writeJson(syncFile, criado)
  return criado
}

function tokenConfere(req) {
  const header = String(req.headers['x-seiko-token'] || '')
  if (!header) return false
  const salvo = loadSync()
  const a = Buffer.from(header)
  const b = Buffer.from(salvo.token)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function enderecosLan() {
  const ips = []
  for (const [nome, lista] of Object.entries(os.networkInterfaces())) {
    if (/virtual|vethernet|wsl|hyper-v|bluetooth|vmware|vbox|loopback|tailscale|zerotier/i.test(nome)) continue
    for (const item of lista || []) {
      const v4 = item.family === 'IPv4' || item.family === 4
      if (v4 && !item.internal) ips.push(`http://${item.address}:${PORT}`)
    }
  }
  return ips
}

function exigirLogin(req, res, next) {
  if (tokenConfere(req)) {
    req.papel = 'dono'
    return next()
  }
  const auth = loadAuth()
  if (!auth) return res.status(401).json({ erro: 'Configure o acesso da loja' })
  const sessao = abrirToken(cookies(req).seiko, auth.secret)
  if (!sessao) return res.status(401).json({ erro: 'Entre novamente' })
  req.papel = sessao.papel === 'funcionario' ? 'funcionario' : 'dono'
  next()
}

function exigirDono(req, res, next) {
  exigirLogin(req, res, () => {
    if (req.papel === 'funcionario') return res.status(403).json({ erro: 'Só o dono acessa esta parte' })
    next()
  })
}

function clientePublico(c) {
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    cpf: c.cpf || '',
    endereco: c.endereco || '',
    numero: c.numero || '',
    bairro: c.bairro || '',
    referencia: c.referencia || '',
    nascimento: c.nascimento || '',
    cadastro: c.cadastro,
    observacoes: c.observacoes || '',
    criadoEm: c.criadoEm,
  }
}

function promissoriaPublica(p) {
  return {
    id: p.id,
    clienteId: p.clienteId,
    produto: p.produto,
    itens: Array.isArray(p.itens) ? p.itens : [],
    valor: p.valor,
    entrada: p.entrada || 0,
    dataVenda: p.dataVenda,
    vencimento: p.vencimento,
    observacoes: p.observacoes || '',
    pagamentos: (p.pagamentos || []).map((item) => ({
      id: item.id,
      valor: item.valor,
      data: item.data,
      forma: item.forma || '',
      obs: item.obs || '',
    })),
    criadoEm: p.criadoEm,
  }
}

function lerItensVenda(body) {
  const brutos = Array.isArray(body.itens) ? body.itens : []
  const itens = brutos
    .map((item) => ({
      produto: limparTexto(item?.produto, 180),
      valor: Math.round(Number(item?.valor) * 100) / 100,
    }))
    .filter((item) => item.produto.length >= 2 && Number.isFinite(item.valor) && item.valor > 0)
  if (itens.length) return itens
  const produto = limparTexto(body.produto, 400)
  const valor = Number(body.valor)
  if (produto.length >= 2 && Number.isFinite(valor) && valor > 0) {
    return [{ produto, valor: Math.round(valor * 100) / 100 }]
  }
  return []
}

function lerPromissoria(body) {
  const itens = lerItensVenda(body)
  const dataVenda = String(body.dataVenda || '')
  const vencimento = String(body.vencimento || '')
  const valor = itens.reduce((acc, item) => acc + item.valor, 0)
  const entrada = body.entrada === '' || body.entrada == null ? 0 : Number(body.entrada)
  if (!itens.length) return { erro: 'Adicione pelo menos um produto' }
  if (!isISODate(dataVenda) || dataVenda > addDays(hojeISO(), 1)) return { erro: 'Data da venda inválida' }
  if (!isISODate(vencimento)) return { erro: 'Data de vencimento inválida' }
  if (!Number.isFinite(valor) || valor <= 0 || valor > 1000000) return { erro: 'Informe o valor da promissória' }
  if (!Number.isFinite(entrada) || entrada < 0 || entrada > valor) return { erro: 'Entrada não pode ser maior que o valor' }
  return {
    valor: {
      produto: itens.map((item) => item.produto).join(' + ').slice(0, 400),
      itens,
      valor: Math.round(valor * 100) / 100,
      entrada: Math.round(entrada * 100) / 100,
      dataVenda,
      vencimento,
      observacoes: limparNota(body.observacoes, 2000),
    },
  }
}

function servicoPublico(s) {
  return {
    id: s.id,
    clienteId: s.clienteId,
    data: s.data,
    tipo: s.tipo,
    marca: s.marca || '',
    modelo: s.modelo || '',
    valor: s.valor,
    pecas: s.pecas || '',
    diagnostico: s.diagnostico || '',
    observacoes: s.observacoes || '',
    prazoDias: s.prazoDias || null,
    garantiaAte: s.garantiaAte || null,
    criadoEm: s.criadoEm,
  }
}

function lerCliente(body, atual) {
  const nome = limparTexto(body.nome, 120)
  const telefone = digits(body.telefone).slice(0, 13)
  const cadastro = body.cadastro || atual?.cadastro || hojeISO()
  const nascimento = body.nascimento ? String(body.nascimento) : ''
  if (nome.length < 3) return { erro: 'Informe o nome completo' }
  if (telefone && telefone.length < 10) return { erro: 'Telefone precisa ter DDD, ou deixe em branco' }
  if (!isISODate(cadastro) || cadastro > addDays(hojeISO(), 1)) return { erro: 'Data de cadastro inválida' }
  if (nascimento && (!isISODate(nascimento) || nascimento > hojeISO())) return { erro: 'Data de nascimento inválida' }
  return {
    valor: {
      nome,
      telefone,
      cpf: digits(body.cpf).slice(0, 11),
      endereco: limparTexto(body.endereco, 180),
      numero: limparTexto(body.numero, 20),
      bairro: limparTexto(body.bairro, 80),
      referencia: limparTexto(body.referencia, 120),
      nascimento,
      cadastro,
      observacoes: limparNota(body.observacoes, 2000),
    },
  }
}

function lerServico(body) {
  const data = String(body.data || '')
  const tipo = limparTexto(body.tipo, 80)
  const prazoBruto = body.prazoDias
  let prazoDias = null
  if (prazoBruto !== '' && prazoBruto !== null && prazoBruto !== undefined && Number(prazoBruto) !== 0) {
    const n = Number(prazoBruto)
    if (!Number.isInteger(n) || n < 1 || n > 3650) return { erro: 'Prazo de garantia inválido' }
    prazoDias = n
  }
  if (body.valor === '' || body.valor === null || body.valor === undefined) return { erro: 'Informe o valor. Use 0 para cortesia.' }
  const valor = Number(body.valor)
  if (!isISODate(data) || data > addDays(hojeISO(), 1)) return { erro: 'Data do serviço inválida' }
  if (tipo.length < 2) return { erro: 'Informe o tipo de serviço' }
  if (!Number.isFinite(valor) || valor < 0 || valor > 1000000) return { erro: 'Informe o valor. Use 0 para cortesia.' }
  return {
    valor: {
      data,
      tipo,
      marca: limparTexto(body.marca, 80),
      modelo: limparTexto(body.modelo, 80),
      valor: Math.round(valor * 100) / 100,
      pecas: limparNota(body.pecas, 500),
      diagnostico: limparNota(body.diagnostico, 2000),
      observacoes: limparNota(body.observacoes, 2000),
      prazoDias,
      garantiaAte: prazoGarantia(data, prazoDias),
    },
  }
}

function csvCelula(v) {
  const s = String(v ?? '')
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function enviarCsv(res, nome, linhas) {
  const corpo = '\uFEFF' + linhas.map((l) => l.map(csvCelula).join(';')).join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`)
  res.send(corpo)
}

function telefoneDuplicado(clients, telefone, ignorarId) {
  if (!telefone || telefone.length < 10) return null
  return clients.find((c) => c.id !== ignorarId && digits(c.telefone) === telefone)
}

const app = express()
app.disable('x-powered-by')
app.use((req, res, next) => {
  const origem = req.headers.origin
  if (origem) {
    res.setHeader('Access-Control-Allow-Origin', origem)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-seiko-token')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json({ limit: '12mb' }))

app.get('/api/me', (req, res) => {
  const auth = loadAuth()
  if (!auth) return res.json({ autenticado: false, precisaConfigurar: true })
  const sessao = abrirToken(cookies(req).seiko, auth.secret)
  if (!sessao) return res.json({ autenticado: false, precisaConfigurar: false })
  const usuario = usuariosDe(auth).find((item) => item.id === sessao.id)
  res.json({
    autenticado: true,
    precisaConfigurar: false,
    nome: usuario?.nome || sessao.nome || auth.nome || 'Seiko',
    papel: sessao.papel === 'funcionario' ? 'funcionario' : 'dono',
  })
})

app.post('/api/setup', (req, res) => {
  if (loadAuth()) return res.status(400).json({ erro: 'O acesso da loja já foi criado' })
  const nome = limparTexto(req.body?.nome, 60)
  const senha = String(req.body?.senha || '')
  if (nome.length < 2) return res.status(400).json({ erro: 'Informe seu nome' })
  if (senha.length < 4) return res.status(400).json({ erro: 'A senha precisa ter pelo menos 4 caracteres' })
  const salt = crypto.randomBytes(16).toString('hex')
  const auth = {
    nome,
    salt,
    hash: hashSenha(senha, salt),
    secret: crypto.randomBytes(32).toString('hex'),
  }
  writeJson(authFile, auth)
  res.setHeader('Set-Cookie', cookieSessao(assinar({ exp: Date.now() + 2592000000, id: 'dono', nome, papel: 'dono' }, auth.secret)))
  res.json({ nome, papel: 'dono' })
})

app.post('/api/login', (req, res) => {
  const auth = loadAuth()
  if (!auth) return res.status(400).json({ erro: 'Configure o acesso da loja' })
  const senha = String(req.body?.senha || '')
  const usuario = usuarioPorSenha(auth, senha)
  if (!usuario) return res.status(401).json({ erro: 'Senha incorreta' })
  const papel = usuario.papel === 'funcionario' ? 'funcionario' : 'dono'
  res.setHeader('Set-Cookie', cookieSessao(assinar({ exp: Date.now() + 2592000000, id: usuario.id, nome: usuario.nome, papel }, auth.secret)))
  res.json({ nome: usuario.nome, papel })
})

app.post('/api/logout', (_req, res) => {
  res.setHeader('Set-Cookie', cookieSessao(''))
  res.json({ ok: true })
})

app.get('/api/data', exigirLogin, (_req, res) => {
  res.json(dadosPublicos(loadCrm()))
})

app.get('/api/rede', exigirDono, (_req, res) => {
  res.json({ enderecos: enderecosLan(), token: loadSync().token })
})

app.get('/api/nuvem', exigirDono, (_req, res) => {
  const nuvem = readJson(path.join(dataDir, 'supabase.json'), null)
  if (!nuvem?.url || !nuvem?.chave || !nuvem?.segredo) return res.status(404).json({ erro: 'Nuvem ainda não configurada' })
  res.json({ url: String(nuvem.url).replace(/\/$/, ''), chave: nuvem.chave, segredo: nuvem.segredo })
})

app.post('/api/estado', exigirLogin, async (req, res, next) => {
  const body = req.body || {}
  if (!Array.isArray(body.clients)) return res.status(400).json({ erro: 'Estado inválido' })
  try {
    const out = await alterarCrm((crm) => {
      crm.clients = body.clients
      crm.services = Array.isArray(body.services) ? body.services : []
      crm.promissorias = Array.isArray(body.promissorias) ? body.promissorias : []
      if (body.credor && typeof body.credor === 'object') crm.credor = body.credor
      return dadosPublicos(crm)
    })
    res.json(out)
  } catch (err) {
    next(err)
  }
})

app.post('/api/sync', exigirLogin, async (req, res, next) => {
  try {
    const out = await alterarCrm((crm) => aplicarOps(crm, req.body?.ops || []))
    res.json(out)
  } catch (err) {
    next(err)
  }
})

app.post('/api/clients', exigirLogin, async (req, res, next) => {
  try {
    const lido = lerCliente(req.body || {})
    if (lido.erro) return res.status(400).json({ erro: lido.erro })
    const salvo = await alterarCrm((crm) => {
      const dup = telefoneDuplicado(crm.clients, lido.valor.telefone)
      if (dup && !req.body?.forcar) {
        const err = new Error('duplicado')
        err.dup = dup
        throw err
      }
      const cliente = { id: crypto.randomUUID(), ...lido.valor, criadoEm: new Date().toISOString() }
      crm.clients.push(cliente)
      return cliente
    })
    res.json(clientePublico(salvo))
  } catch (err) {
    if (err.dup) {
      return res.status(409).json({
        erro: 'Já existe um cliente com este telefone',
        cliente: { id: err.dup.id, nome: err.dup.nome, telefone: err.dup.telefone },
      })
    }
    next(err)
  }
})

app.put('/api/clients/:id', exigirLogin, async (req, res, next) => {
  try {
    const salvo = await alterarCrm((crm) => {
      const atual = crm.clients.find((c) => c.id === req.params.id)
      if (!atual) {
        const err = new Error('ausente')
        err.status = 404
        throw err
      }
      const lido = lerCliente(req.body || {}, atual)
      if (lido.erro) {
        const err = new Error(lido.erro)
        err.status = 400
        throw err
      }
      const dup = telefoneDuplicado(crm.clients, lido.valor.telefone, atual.id)
      if (dup && !req.body?.forcar) {
        const err = new Error('duplicado')
        err.dup = dup
        throw err
      }
      Object.assign(atual, lido.valor)
      return atual
    })
    res.json(clientePublico(salvo))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ erro: 'Cliente não encontrado' })
    if (err.status === 400) return res.status(400).json({ erro: err.message })
    if (err.dup) {
      return res.status(409).json({
        erro: 'Já existe um cliente com este telefone',
        cliente: { id: err.dup.id, nome: err.dup.nome, telefone: err.dup.telefone },
      })
    }
    next(err)
  }
})

app.delete('/api/clients/:id', exigirLogin, async (req, res, next) => {
  try {
    const ok = await alterarCrm((crm) => {
      const antes = crm.clients.length
      crm.clients = crm.clients.filter((c) => c.id !== req.params.id)
      crm.services = crm.services.filter((s) => s.clienteId !== req.params.id)
      crm.promissorias = crm.promissorias.filter((p) => p.clienteId !== req.params.id)
      return crm.clients.length < antes
    })
    if (!ok) return res.status(404).json({ erro: 'Cliente não encontrado' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

app.post('/api/services', exigirLogin, async (req, res, next) => {
  try {
    const lido = lerServico(req.body || {})
    if (lido.erro) return res.status(400).json({ erro: lido.erro })
    const salvo = await alterarCrm((crm) => {
      if (!crm.clients.some((c) => c.id === req.body?.clienteId)) {
        const err = new Error('ausente')
        err.status = 404
        throw err
      }
      const servico = {
        id: crypto.randomUUID(),
        clienteId: req.body.clienteId,
        ...lido.valor,
        criadoEm: new Date().toISOString(),
      }
      crm.services.push(servico)
      return servico
    })
    res.json(servicoPublico(salvo))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ erro: 'Cliente não encontrado' })
    next(err)
  }
})

app.put('/api/services/:id', exigirLogin, async (req, res, next) => {
  try {
    const lido = lerServico(req.body || {})
    if (lido.erro) return res.status(400).json({ erro: lido.erro })
    const salvo = await alterarCrm((crm) => {
      const atual = crm.services.find((s) => s.id === req.params.id)
      if (!atual) {
        const err = new Error('ausente')
        err.status = 404
        throw err
      }
      Object.assign(atual, lido.valor)
      return atual
    })
    res.json(servicoPublico(salvo))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ erro: 'Serviço não encontrado' })
    next(err)
  }
})

app.delete('/api/services/:id', exigirLogin, async (req, res, next) => {
  try {
    const ok = await alterarCrm((crm) => {
      const antes = crm.services.length
      crm.services = crm.services.filter((s) => s.id !== req.params.id)
      return crm.services.length < antes
    })
    if (!ok) return res.status(404).json({ erro: 'Serviço não encontrado' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

app.post('/api/promissorias', exigirLogin, async (req, res, next) => {
  try {
    const lido = lerPromissoria(req.body || {})
    if (lido.erro) return res.status(400).json({ erro: lido.erro })
    const salvo = await alterarCrm((crm) => {
      if (!crm.clients.some((c) => c.id === req.body?.clienteId)) {
        const err = new Error('ausente')
        err.status = 404
        throw err
      }
      const item = {
        id: crypto.randomUUID(),
        clienteId: req.body.clienteId,
        ...lido.valor,
        pagamentos: [],
        criadoEm: new Date().toISOString(),
      }
      crm.promissorias.push(item)
      return item
    })
    res.json(promissoriaPublica(salvo))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ erro: 'Cliente não encontrado' })
    next(err)
  }
})

app.put('/api/promissorias/:id', exigirLogin, async (req, res, next) => {
  try {
    const lido = lerPromissoria(req.body || {})
    if (lido.erro) return res.status(400).json({ erro: lido.erro })
    const salvo = await alterarCrm((crm) => {
      const atual = crm.promissorias.find((p) => p.id === req.params.id)
      if (!atual) {
        const err = new Error('ausente')
        err.status = 404
        throw err
      }
      const extra = (atual.pagamentos || []).reduce((acc, item) => acc + Number(item.valor || 0), 0)
      if (lido.valor.valor + 0.01 < extra) {
        const err = new Error('O valor dos produtos ficou menor que os pagamentos já lançados')
        err.status = 400
        throw err
      }
      Object.assign(atual, lido.valor)
      return atual
    })
    res.json(promissoriaPublica(salvo))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ erro: 'Promissória não encontrada' })
    if (err.status === 400) return res.status(400).json({ erro: err.message })
    next(err)
  }
})

app.delete('/api/promissorias/:id', exigirLogin, async (req, res, next) => {
  try {
    const ok = await alterarCrm((crm) => {
      const antes = crm.promissorias.length
      crm.promissorias = crm.promissorias.filter((p) => p.id !== req.params.id)
      return crm.promissorias.length < antes
    })
    if (!ok) return res.status(404).json({ erro: 'Promissória não encontrada' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

app.post('/api/promissorias/:id/pagamentos', exigirLogin, async (req, res, next) => {
  try {
    const valor = Number(req.body?.valor)
    const data = String(req.body?.data || '')
    if (!Number.isFinite(valor) || valor <= 0) return res.status(400).json({ erro: 'Informe o valor pago' })
    if (!isISODate(data)) return res.status(400).json({ erro: 'Data do pagamento inválida' })
    const salvo = await alterarCrm((crm) => {
      const atual = crm.promissorias.find((p) => p.id === req.params.id)
      if (!atual) {
        const err = new Error('ausente')
        err.status = 404
        throw err
      }
      atual.pagamentos ||= []
      const entrada = Number(atual.entrada || 0)
      const extra = atual.pagamentos.reduce((acc, item) => acc + Number(item.valor || 0), 0)
      const saldo = Math.max(0, Number(atual.valor) - entrada - extra)
      if (valor > saldo + 0.01) {
        const err = new Error('O valor é maior que o saldo restante')
        err.status = 400
        throw err
      }
      atual.pagamentos.push({
        id: crypto.randomUUID(),
        valor: Math.round(valor * 100) / 100,
        data,
        forma: limparTexto(req.body?.forma, 40),
        obs: limparNota(req.body?.obs, 400),
      })
      return atual
    })
    res.json(promissoriaPublica(salvo))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ erro: 'Promissória não encontrada' })
    if (err.status === 400) return res.status(400).json({ erro: err.message })
    next(err)
  }
})

app.delete('/api/promissorias/:id/pagamentos/:pagId', exigirLogin, async (req, res, next) => {
  try {
    const salvo = await alterarCrm((crm) => {
      const atual = crm.promissorias.find((p) => p.id === req.params.id)
      if (!atual) {
        const err = new Error('ausente')
        err.status = 404
        throw err
      }
      atual.pagamentos = (atual.pagamentos || []).filter((item) => item.id !== req.params.pagId)
      return atual
    })
    res.json(promissoriaPublica(salvo))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ erro: 'Promissória não encontrada' })
    next(err)
  }
})

app.put('/api/credor', exigirLogin, async (req, res, next) => {
  try {
    const salvo = await alterarCrm((crm) => {
      crm.credor = {
        nome: limparTexto(req.body?.nome, 120) || 'Studio Seiko',
        documento: limparTexto(req.body?.documento, 20),
        telefone: digits(req.body?.telefone).slice(0, 13),
        endereco: limparTexto(req.body?.endereco, 180),
        cidade: limparTexto(req.body?.cidade, 80) || 'Cururupu-MA',
      }
      return crm.credor
    })
    res.json(salvo)
  } catch (err) {
    next(err)
  }
})

app.get('/api/backup.json', exigirDono, async (_req, res, next) => {
  try {
    const crm = await alterarCrm((dados) => {
      dados.ultimoBackup = new Date().toISOString()
      return dados
    })
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="backup-studio-seiko.json"`)
    res.send(JSON.stringify({
      clients: crm.clients,
      services: crm.services,
      promissorias: crm.promissorias,
      credor: crm.credor || {},
      ultimoBackup: crm.ultimoBackup,
    }, null, 2))
  } catch (err) {
    next(err)
  }
})

function converterBackup(body) {
  if (Array.isArray(body?.clients)) {
    return {
      origem: 'crm',
      clients: body.clients,
      services: Array.isArray(body.services) ? body.services : [],
      promissorias: Array.isArray(body.promissorias) ? body.promissorias : [],
      credor: body.credor && typeof body.credor === 'object' ? body.credor : null,
    }
  }
  if (!Array.isArray(body?.clientes)) return null
  const clients = []
  const promissorias = []
  const porTel = new Map()
  for (const item of body.clientes) {
    const tel = digits(item.telefone)
    let cliente = tel ? porTel.get(tel) : null
    if (!cliente) {
      cliente = {
        id: crypto.randomUUID(),
        nome: limparTexto(item.nome, 120) || 'Cliente',
        telefone: tel,
        cpf: digits(item.cpf).slice(0, 11),
        endereco: limparTexto([item.endereco, item.cidade].filter(Boolean).join(', '), 180),
        numero: limparTexto(item.numero, 20),
        bairro: limparTexto(item.bairro, 80),
        referencia: limparTexto(item.referencia, 120),
        nascimento: '',
        cadastro: item.venda?.dataVenda || hojeISO(),
        observacoes: limparNota(item.obs, 2000),
        criadoEm: new Date().toISOString(),
      }
      if (tel) porTel.set(tel, cliente)
      clients.push(cliente)
    }
    const venda = item.venda || {}
    promissorias.push({
      id: crypto.randomUUID(),
      clienteId: cliente.id,
      produto: limparTexto(venda.produto, 180) || 'Venda',
      valor: Number(venda.valor) || 0,
      entrada: Number(venda.entrada) || 0,
      dataVenda: isISODate(venda.dataVenda) ? venda.dataVenda : hojeISO(),
      vencimento: isISODate(venda.vencimento) ? venda.vencimento : hojeISO(),
      observacoes: limparNota(item.obs, 2000),
      pagamentos: (item.pagamentos || []).map((pag) => ({
        id: String(pag.id || crypto.randomUUID()),
        valor: Number(pag.valor) || 0,
        data: isISODate(pag.data) ? pag.data : hojeISO(),
        forma: limparTexto(pag.forma, 40),
        obs: limparNota(pag.obs, 400),
      })),
      criadoEm: new Date().toISOString(),
    })
  }
  return {
    origem: 'promissoria',
    clients,
    services: [],
    promissorias,
    credor: body.credor && typeof body.credor === 'object' ? body.credor : null,
  }
}

app.post('/api/backup/restaurar', exigirDono, async (req, res, next) => {
  try {
    const convertido = converterBackup(req.body || {})
    if (!convertido) return res.status(400).json({ erro: 'Arquivo de backup inválido' })
    await alterarCrm((crm) => {
      crm.clients = convertido.clients
      crm.services = convertido.services
      crm.promissorias = convertido.promissorias
      if (convertido.credor) {
        crm.credor = {
          nome: limparTexto(convertido.credor.nome, 120) || crm.credor?.nome || 'Studio Seiko',
          documento: limparTexto(convertido.credor.documento, 20),
          telefone: digits(convertido.credor.telefone).slice(0, 13),
          endereco: limparTexto(convertido.credor.endereco, 180),
          cidade: limparTexto(convertido.credor.cidade, 80) || crm.credor?.cidade || 'Cururupu-MA',
        }
      }
      crm.ultimoBackup = new Date().toISOString()
    })
    res.json({ ok: true, origem: convertido.origem })
  } catch (err) {
    next(err)
  }
})

app.post('/api/reset', exigirDono, async (_req, res, next) => {
  try {
    await alterarCrm((crm) => {
      crm.clients = []
      crm.services = []
      crm.promissorias = []
      crm.ultimoBackup = ''
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

app.get('/api/export/clientes.csv', exigirLogin, (_req, res) => {
  const crm = loadCrm()
  const linhas = [['nome', 'telefone', 'endereco', 'numero', 'bairro', 'referencia', 'nascimento', 'cadastro', 'observacoes']]
  for (const c of crm.clients) {
    linhas.push([c.nome, formatPhone(c.telefone), c.endereco || '', c.numero || '', c.bairro || '', c.referencia || '', c.nascimento || '', c.cadastro, c.observacoes || ''])
  }
  enviarCsv(res, 'clientes-studio-seiko.csv', linhas)
})

app.get('/api/export/servicos.csv', exigirLogin, (_req, res) => {
  const crm = loadCrm()
  const porId = new Map(crm.clients.map((c) => [c.id, c]))
  const linhas = [[
    'cliente', 'telefone', 'data', 'tipo', 'marca', 'modelo', 'valor',
    'pecas', 'diagnostico', 'observacoes', 'prazo_dias', 'garantia_ate',
  ]]
  for (const s of crm.services) {
    const c = porId.get(s.clienteId)
    linhas.push([
      c?.nome || '', formatPhone(c?.telefone), s.data, s.tipo, s.marca || '', s.modelo || '',
      s.valor, s.pecas || '', s.diagnostico || '', s.observacoes || '', s.prazoDias || '', s.garantiaAte || '',
    ])
  }
  enviarCsv(res, 'servicos-studio-seiko.csv', linhas)
})

app.use('/api', (err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ erro: 'Erro interno' })
})

const server = http.createServer(app)
const vite = await createVite({
  root,
  server: { middlewareMode: true, hmr: { server } },
  appType: 'spa',
})
app.use(vite.middlewares)

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} ja esta em uso. Abra http://127.0.0.1:${PORT} ou feche a outra janela do CRM.`)
    process.exit(1)
  }
  throw err
})
server.listen(PORT, '0.0.0.0', () => {
  console.log(`CRM Studio Seiko em http://127.0.0.1:${PORT}`)
  for (const url of enderecosLan()) console.log(`Na rede da loja: ${url}`)
  console.log('Sem internet, o navegador abre a ultima copia salva neste aparelho.')
})
