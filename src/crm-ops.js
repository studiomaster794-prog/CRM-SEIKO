import { addDays, digits, hojeISO, isISODate, prazoGarantia } from './logic.js'

function novoId() {
  return globalThis.crypto.randomUUID()
}

function limparTexto(v, max) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function limparNota(v, max) {
  return String(v || '').replace(/\r\n/g, '\n').trim().slice(0, max)
}

export function credorPadrao() {
  return { nome: 'Studio Seiko', documento: '', telefone: '', endereco: '', cidade: 'Cururupu-MA' }
}

export function crmVazio() {
  return { clients: [], services: [], promissorias: [], credor: credorPadrao(), ultimoBackup: '' }
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

export function dadosPublicos(crm) {
  const base = crm || crmVazio()
  return {
    clients: (base.clients || []).map(clientePublico),
    services: (base.services || []).map(servicoPublico),
    promissorias: (base.promissorias || []).map(promissoriaPublica),
    credor: base.credor || credorPadrao(),
    ultimoBackup: base.ultimoBackup || '',
  }
}

function telefoneDuplicado(clients, telefone, ignorarId) {
  if (!telefone || telefone.length < 10) return null
  return clients.find((c) => c.id !== ignorarId && digits(c.telefone) === telefone)
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

function idPronto(v) {
  const s = String(v || '')
  return /^[0-9a-zA-Z-]{8,80}$/.test(s) ? s : ''
}

function falha(status, data) {
  return { status, data }
}

function rota(path) {
  const limpo = String(path || '').split('?')[0].replace(/\/+$/, '') || '/'
  const sem = limpo.replace(/^\/api/, '') || '/'
  return sem.startsWith('/') ? sem : `/${sem}`
}

function aplicarDraft(crm, method, path, body) {
  const p = rota(path)
  const verbo = String(method || 'GET').toUpperCase()

  if (verbo === 'POST' && p === '/clients') {
    const lido = lerCliente(body)
    if (lido.erro) return falha(400, { erro: lido.erro })
    const ja = idPronto(body.id) && crm.clients.find((c) => c.id === body.id)
    if (ja) return { status: 200, data: clientePublico(ja) }
    const dup = telefoneDuplicado(crm.clients, lido.valor.telefone)
    if (dup && !body.forcar) {
      return falha(409, {
        erro: 'Já existe um cliente com este telefone',
        cliente: { id: dup.id, nome: dup.nome, telefone: dup.telefone },
      })
    }
    const cliente = { id: idPronto(body.id) || novoId(), ...lido.valor, criadoEm: new Date().toISOString() }
    crm.clients.push(cliente)
    return { status: 200, data: clientePublico(cliente) }
  }

  const clienteId = p.match(/^\/clients\/([^/]+)$/)
  if (clienteId && verbo === 'PUT') {
    const atual = crm.clients.find((c) => c.id === clienteId[1])
    if (!atual) return falha(404, { erro: 'Cliente não encontrado' })
    const lido = lerCliente(body, atual)
    if (lido.erro) return falha(400, { erro: lido.erro })
    const dup = telefoneDuplicado(crm.clients, lido.valor.telefone, atual.id)
    if (dup && !body.forcar) {
      return falha(409, {
        erro: 'Já existe um cliente com este telefone',
        cliente: { id: dup.id, nome: dup.nome, telefone: dup.telefone },
      })
    }
    Object.assign(atual, lido.valor)
    return { status: 200, data: clientePublico(atual) }
  }

  if (clienteId && verbo === 'DELETE') {
    const antes = crm.clients.length
    crm.clients = crm.clients.filter((c) => c.id !== clienteId[1])
    crm.services = crm.services.filter((s) => s.clienteId !== clienteId[1])
    crm.promissorias = crm.promissorias.filter((item) => item.clienteId !== clienteId[1])
    if (crm.clients.length === antes) return falha(404, { erro: 'Cliente não encontrado' })
    return { status: 200, data: { ok: true } }
  }

  if (verbo === 'POST' && p === '/services') {
    const lido = lerServico(body)
    if (lido.erro) return falha(400, { erro: lido.erro })
    if (!crm.clients.some((c) => c.id === body.clienteId)) return falha(404, { erro: 'Cliente não encontrado' })
    const ja = idPronto(body.id) && crm.services.find((s) => s.id === body.id)
    if (ja) return { status: 200, data: servicoPublico(ja) }
    const servico = {
      id: idPronto(body.id) || novoId(),
      clienteId: body.clienteId,
      ...lido.valor,
      criadoEm: new Date().toISOString(),
    }
    crm.services.push(servico)
    return { status: 200, data: servicoPublico(servico) }
  }

  const servicoId = p.match(/^\/services\/([^/]+)$/)
  if (servicoId && verbo === 'PUT') {
    const lido = lerServico(body)
    if (lido.erro) return falha(400, { erro: lido.erro })
    const atual = crm.services.find((s) => s.id === servicoId[1])
    if (!atual) return falha(404, { erro: 'Serviço não encontrado' })
    Object.assign(atual, lido.valor)
    return { status: 200, data: servicoPublico(atual) }
  }

  if (servicoId && verbo === 'DELETE') {
    const antes = crm.services.length
    crm.services = crm.services.filter((s) => s.id !== servicoId[1])
    if (crm.services.length === antes) return falha(404, { erro: 'Serviço não encontrado' })
    return { status: 200, data: { ok: true } }
  }

  if (verbo === 'POST' && p === '/promissorias') {
    const lido = lerPromissoria(body)
    if (lido.erro) return falha(400, { erro: lido.erro })
    if (!crm.clients.some((c) => c.id === body.clienteId)) return falha(404, { erro: 'Cliente não encontrado' })
    const ja = idPronto(body.id) && crm.promissorias.find((item) => item.id === body.id)
    if (ja) return { status: 200, data: promissoriaPublica(ja) }
    const item = {
      id: idPronto(body.id) || novoId(),
      clienteId: body.clienteId,
      ...lido.valor,
      pagamentos: [],
      criadoEm: new Date().toISOString(),
    }
    crm.promissorias.push(item)
    return { status: 200, data: promissoriaPublica(item) }
  }

  const pag = p.match(/^\/promissorias\/([^/]+)\/pagamentos\/([^/]+)$/)
  if (pag && verbo === 'DELETE') {
    const atual = crm.promissorias.find((item) => item.id === pag[1])
    if (!atual) return falha(404, { erro: 'Promissória não encontrada' })
    atual.pagamentos = (atual.pagamentos || []).filter((item) => item.id !== pag[2])
    return { status: 200, data: promissoriaPublica(atual) }
  }

  const pagNovo = p.match(/^\/promissorias\/([^/]+)\/pagamentos$/)
  if (pagNovo && verbo === 'POST') {
    const valor = Number(body.valor)
    const data = String(body.data || '')
    if (!Number.isFinite(valor) || valor <= 0) return falha(400, { erro: 'Informe o valor pago' })
    if (!isISODate(data)) return falha(400, { erro: 'Data do pagamento inválida' })
    const atual = crm.promissorias.find((item) => item.id === pagNovo[1])
    if (!atual) return falha(404, { erro: 'Promissória não encontrada' })
    atual.pagamentos ||= []
    const entrada = Number(atual.entrada || 0)
    const extra = atual.pagamentos.reduce((acc, item) => acc + Number(item.valor || 0), 0)
    const saldo = Math.max(0, Number(atual.valor) - entrada - extra)
    if (body.id && atual.pagamentos.some((item) => item.id === body.id)) return { status: 200, data: promissoriaPublica(atual) }
    if (valor > saldo + 0.01) return falha(400, { erro: 'O valor é maior que o saldo restante' })
    atual.pagamentos.push({
      id: idPronto(body.id) || novoId(),
      valor: Math.round(valor * 100) / 100,
      data,
      forma: limparTexto(body.forma, 40),
      obs: limparNota(body.obs, 400),
    })
    return { status: 200, data: promissoriaPublica(atual) }
  }

  const promId = p.match(/^\/promissorias\/([^/]+)$/)
  if (promId && verbo === 'PUT') {
    const lido = lerPromissoria(body)
    if (lido.erro) return falha(400, { erro: lido.erro })
    const atual = crm.promissorias.find((item) => item.id === promId[1])
    if (!atual) return falha(404, { erro: 'Promissória não encontrada' })
    const extra = (atual.pagamentos || []).reduce((acc, item) => acc + Number(item.valor || 0), 0)
    if (lido.valor.valor + 0.01 < extra) {
      return falha(400, { erro: 'O valor dos produtos ficou menor que os pagamentos já lançados' })
    }
    Object.assign(atual, lido.valor)
    return { status: 200, data: promissoriaPublica(atual) }
  }

  if (promId && verbo === 'DELETE') {
    const antes = crm.promissorias.length
    crm.promissorias = crm.promissorias.filter((item) => item.id !== promId[1])
    if (crm.promissorias.length === antes) return falha(404, { erro: 'Promissória não encontrada' })
    return { status: 200, data: { ok: true } }
  }

  if (verbo === 'PUT' && p === '/credor') {
    crm.credor = {
      nome: limparTexto(body.nome, 120) || 'Studio Seiko',
      documento: limparTexto(body.documento, 20),
      telefone: digits(body.telefone).slice(0, 13),
      endereco: limparTexto(body.endereco, 180),
      cidade: limparTexto(body.cidade, 80) || 'Cururupu-MA',
    }
    return { status: 200, data: crm.credor }
  }

  if (verbo === 'POST' && p === '/backup/restaurar') {
    const convertido = converterBackup(body)
    if (!convertido) return falha(400, { erro: 'Arquivo de backup inválido' })
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
    return { status: 200, data: { ok: true, origem: convertido.origem } }
  }

  if (verbo === 'POST' && p === '/reset') {
    crm.clients = []
    crm.services = []
    crm.promissorias = []
    crm.ultimoBackup = ''
    return { status: 200, data: { ok: true } }
  }

  return falha(404, { erro: 'Não foi possível concluir' })
}

export function aplicar(crm, method, path, body = {}) {
  const draft = structuredClone(crm || crmVazio())
  draft.clients ||= []
  draft.services ||= []
  draft.promissorias ||= []
  const r = aplicarDraft(draft, method, path, body || {})
  if (r.status === 200) {
    crm.clients = draft.clients
    crm.services = draft.services
    crm.promissorias = draft.promissorias
    crm.credor = draft.credor
    crm.ultimoBackup = draft.ultimoBackup
  }
  return r
}

export function aplicarOps(crm, ops) {
  crm.opsAplicados ||= []
  const aceitos = []
  const rejeitados = []
  const lista = Array.isArray(ops) ? ops.slice(0, 500) : []
  const ordenados = lista
    .filter((op) => op && op.id && op.method && op.path)
    .sort((a, b) => String(a.em || '').localeCompare(String(b.em || '')))
  for (const op of ordenados) {
    if (crm.opsAplicados.includes(op.id)) {
      aceitos.push(op.id)
      continue
    }
    const r = aplicar(crm, op.method, op.path, op.body || {})
    if (r.status !== 200) {
      rejeitados.push({ id: op.id, erro: r.data?.erro || 'Não foi possível sincronizar', status: r.status })
      continue
    }
    crm.opsAplicados.push(op.id)
    aceitos.push(op.id)
  }
  if (crm.opsAplicados.length > 4000) crm.opsAplicados.splice(0, crm.opsAplicados.length - 3000)
  return { aceitos, rejeitados, ...dadosPublicos(crm) }
}

export function converterBackup(body) {
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
        id: novoId(),
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
      id: novoId(),
      clienteId: cliente.id,
      produto: limparTexto(venda.produto, 180) || 'Venda',
      valor: Number(venda.valor) || 0,
      entrada: Number(venda.entrada) || 0,
      dataVenda: isISODate(venda.dataVenda) ? venda.dataVenda : hojeISO(),
      vencimento: isISODate(venda.vencimento) ? venda.vencimento : hojeISO(),
      observacoes: limparNota(item.obs, 2000),
      pagamentos: (item.pagamentos || []).map((pag) => ({
        id: String(pag.id || novoId()),
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
