import { aplicar, dadosPublicos } from './crm-ops.js'

function cabecalhos(cfg) {
  return {
    apikey: cfg.chave,
    'Content-Type': 'application/json',
    'x-crm-chave': cfg.segredo,
  }
}

function temGente(dados) {
  return Array.isArray(dados?.clients) && dados.clients.length > 0
}

async function lerNuvem(cfg) {
  const res = await fetch(`${cfg.url}/rest/v1/crm_estado?id=eq.1&select=dados,atualizado_em`, {
    headers: cabecalhos(cfg),
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 404) return { pronta: false }
  if (!res.ok) return { pronta: false }
  const rows = await res.json()
  return { pronta: true, row: rows[0] || null }
}

async function escreverNuvem(cfg, dados, emEsperado) {
  const atualizado_em = new Date().toISOString()
  if (!emEsperado) {
    const res = await fetch(`${cfg.url}/rest/v1/crm_estado?on_conflict=id`, {
      method: 'POST',
      headers: { ...cabecalhos(cfg), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, dados, atualizado_em }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok ? atualizado_em : ''
  }
  const res = await fetch(
    `${cfg.url}/rest/v1/crm_estado?id=eq.1&atualizado_em=eq.${encodeURIComponent(emEsperado)}`,
    {
      method: 'PATCH',
      headers: { ...cabecalhos(cfg), Prefer: 'return=representation' },
      body: JSON.stringify({ dados, atualizado_em }),
      signal: AbortSignal.timeout(8000),
    },
  )
  if (!res.ok) return ''
  const rows = await res.json()
  return Array.isArray(rows) && rows.length ? atualizado_em : ''
}

function crmDe(dados) {
  return {
    clients: dados?.clients || [],
    services: dados?.services || [],
    promissorias: dados?.promissorias || [],
    credor: dados?.credor,
    ultimoBackup: dados?.ultimoBackup || '',
  }
}

export async function sincronizarNuvem(est, cfg) {
  if (!cfg?.url || !cfg?.chave || !cfg?.segredo) return false
  let lido
  try {
    lido = await lerNuvem(cfg)
  } catch {
    return false
  }
  if (!lido.pronta) return false

  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const remoto = lido.row
    const local = dadosPublicos(est.crm)
    const hash = JSON.stringify(local)
    const vazio = !temGente(local) && !est.outbox.length
    const nuvemTem = remoto && temGente(remoto.dados)

    if (!remoto && !vazio) {
      const em = await escreverNuvem(cfg, local, null)
      if (!em) return false
      est.nuvemEm = em
      est.nuvemHash = hash
      est.outbox = []
      return true
    }

    if (remoto && vazio) {
      est.crm = crmDe(remoto.dados)
      est.nuvemEm = remoto.atualizado_em
      est.nuvemHash = JSON.stringify(dadosPublicos(est.crm))
      return true
    }

    if (remoto && remoto.atualizado_em === est.nuvemEm && !est.outbox.length && hash === est.nuvemHash) {
      return true
    }

    let crm = est.crm
    if (remoto && (remoto.atualizado_em !== est.nuvemEm || est.outbox.length)) {
      if (est.outbox.length && remoto.atualizado_em !== est.nuvemEm) {
        crm = crmDe(remoto.dados)
        for (const op of est.outbox) aplicar(crm, op.method, op.path, op.body || {})
      } else if (!est.outbox.length && (est.nuvemEm || '') < (remoto.atualizado_em || '')) {
        est.crm = crmDe(remoto.dados)
        est.nuvemEm = remoto.atualizado_em
        est.nuvemHash = JSON.stringify(dadosPublicos(est.crm))
        return true
      }
    }

    const em = await escreverNuvem(cfg, dadosPublicos(crm), remoto?.atualizado_em || null)
    if (em) {
      est.crm = crm
      est.nuvemEm = em
      est.nuvemHash = JSON.stringify(dadosPublicos(crm))
      est.outbox = []
      return true
    }
    try {
      lido = await lerNuvem(cfg)
    } catch {
      return false
    }
    if (!lido.pronta) return false
  }
  return false
}
