export const JANELA_GARANTIA = 15
export const JANELA_POS = 7
export const SUMICO_DIAS = 365

export const TIPOS = [
  'Troca de bateria',
  'Troca de vidro',
  'Troca de pulseira',
  'Ajuste de pulseira',
  'Revisão',
  'Conserto completo',
  'Vedação',
  'Polimento',
  'Regulagem',
]

export const MARCAS = [
  'Seiko',
  'Casio',
  'Orient',
  'Technos',
  'Champion',
  'Condor',
  'Mondaine',
  'Citizen',
  'Apple',
  'Samsung',
  'Garmin',
]

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function digits(v) {
  return String(v || '').replace(/\D/g, '')
}

export function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function hojeISO(data = new Date()) {
  const z = new Date(data.getTime() - data.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

export function isISODate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + Number(days))
  return dt.toISOString().slice(0, 10)
}

export function md(iso) {
  if (!isISODate(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

export function diasEntre(de, ate) {
  const a = Date.parse(de + 'T00:00:00Z')
  const b = Date.parse(ate + 'T00:00:00Z')
  return Math.round((b - a) / 86400000)
}

export function dataCurta(iso) {
  const x = md(iso)
  if (!x) return '—'
  return `${String(x.d).padStart(2, '0')}/${String(x.m).padStart(2, '0')}/${x.y}`
}

export function dataLonga(iso) {
  const x = md(iso)
  if (!x) return '—'
  return `${x.d} de ${MESES[x.m - 1]} de ${x.y}`
}

export function diaSemana(iso) {
  const x = md(iso)
  if (!x) return ''
  const dt = new Date(x.y, x.m - 1, x.d)
  return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][dt.getDay()]
}

export function idade(iso, hoje) {
  const a = md(iso)
  const h = md(hoje)
  if (!a || !h) return null
  let n = h.y - a.y
  if (h.m < a.m || (h.m === a.m && h.d < a.d)) n -= 1
  return n >= 0 && n < 130 ? n : null
}

const MIUDAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

export function nomeProprio(v) {
  return String(v || '').replace(/(^|[^\p{L}])(\p{L})(\p{L}*)/gu, (_, sep, letra, resto, offset) => {
    const palavra = (letra + resto).toLocaleLowerCase('pt-BR')
    if (offset > 0 && MIUDAS.has(palavra)) return sep + palavra
    return sep + letra.toLocaleUpperCase('pt-BR') + resto
  })
}

export function formatPhone(v) {
  const d = digits(v).slice(0, 11)
  if (!d) return ''
  if (d.length < 3) return `(${d}`
  const ddd = d.slice(0, 2)
  const r = d.slice(2)
  if (d.length <= 6) return `(${ddd}) ${r}`
  if (d.length <= 10) return `(${ddd}) ${r.slice(0, 4)}-${r.slice(4)}`
  return `(${ddd}) ${r.slice(0, 5)}-${r.slice(5, 9)}`
}

export function linhaEndereco(c) {
  if (!c) return ''
  const rua = [c.endereco, c.numero ? `nº ${c.numero}` : ''].filter(Boolean).join(', ')
  const base = [rua, c.bairro].filter(Boolean).join(' — ')
  return c.referencia ? [base, `Ref: ${c.referencia}`].filter(Boolean).join(' · ') : base
}

export function formatCpf(v) {
  const d = digits(v).slice(0, 11)
  if (!d) return ''
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function moeda(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function primeiroNome(nome) {
  const p = String(nome || '').trim().split(/\s+/)[0]
  return p || 'cliente'
}

export function msgPos(nome) {
  const n = primeiroNome(nome)
  return `Olá, seu ${n}! Aqui é do Studio Seiko. Estamos entrando em contato para saber se seu relógio está funcionando direitinho após o nosso atendimento.`
}

export function msgNiver(nome) {
  const n = primeiroNome(nome)
  return `Feliz aniversário, seu ${n}! Toda a equipe do Studio Seiko deseja muita saúde e felicidade. Temos um presente especial para você!`
}

export function msgGarantia(nome, ate) {
  const n = primeiroNome(nome)
  return `Olá, seu ${n}! Aqui é do Studio Seiko. A garantia do seu atendimento vai até ${dataCurta(ate)}. Se precisar de algo, estamos à disposição.`
}

export function msgRetorno(nome) {
  const n = primeiroNome(nome)
  return `Olá, seu ${n}! Aqui é do Studio Seiko. Faz um tempo desde o seu último atendimento. Se o seu relógio precisar de revisão, é só chamar.`
}

export function waLink(telefone, texto) {
  let n = digits(telefone)
  if (!n) return ''
  if (!n.startsWith('55')) n = `55${n}`
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`
}

export function prazoGarantia(data, prazoDias) {
  const n = Number(prazoDias)
  if (!isISODate(data) || !Number.isInteger(n) || n <= 0) return null
  return addDays(data, n)
}

export function statusGarantia(servico, hoje) {
  if (!servico?.garantiaAte) return 'sem'
  const dias = diasEntre(hoje, servico.garantiaAte)
  if (dias < 0) return 'vencida'
  if (dias <= JANELA_GARANTIA) return 'avencer'
  return 'vigente'
}

export function textoPrazo(dias) {
  if (dias < 0) {
    const v = Math.abs(dias)
    return v === 1 ? 'vencida há 1 dia' : `vencida há ${v} dias`
  }
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

export function servicosDo(services, clienteId) {
  return services
    .filter((s) => s.clienteId === clienteId)
    .slice()
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.criadoEm < b.criadoEm ? 1 : -1))
}

export function aniversariantes(clients, hoje) {
  const h = md(hoje)
  const lista = clients
    .filter((c) => md(c.nascimento)?.m === h.m)
    .slice()
    .sort((a, b) => md(a.nascimento).d - md(b.nascimento).d || a.nome.localeCompare(b.nome, 'pt-BR'))
  return {
    hoje: lista.filter((c) => md(c.nascimento).d === h.d),
    mes: lista,
  }
}

export function gruposContato(clients, services, hoje) {
  const inicioPos = addDays(hoje, -JANELA_POS)
  const limite = addDays(hoje, -SUMICO_DIAS)
  const pos = []
  const garantia = []
  const sumidos = []

  for (const c of clients) {
    const lista = servicosDo(services, c.id)
    const recente = lista.find((s) => s.data >= inicioPos && s.data <= hoje)
    if (recente) pos.push({ cliente: c, servico: recente })

    const aVencer = lista
      .filter((s) => statusGarantia(s, hoje) === 'avencer')
      .sort((a, b) => (a.garantiaAte < b.garantiaAte ? -1 : 1))[0]
    if (aVencer) {
      garantia.push({
        cliente: c,
        servico: aVencer,
        dias: diasEntre(hoje, aVencer.garantiaAte),
      })
    }

    const ultima = lista[0]?.data || c.cadastro
    if (ultima && ultima <= limite) sumidos.push({ cliente: c, desde: ultima })
  }

  const porNome = (a, b) => a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR')
  pos.sort(porNome)
  garantia.sort((a, b) => a.dias - b.dias || porNome(a, b))
  sumidos.sort(porNome)
  return { pos, garantia, sumidos }
}

export function idsAcompanhar(grupos) {
  const ids = new Set()
  for (const item of [...grupos.garantia, ...grupos.pos, ...grupos.sumidos]) ids.add(item.cliente.id)
  return ids
}

export function filaContato(clients, services, hoje) {
  const grupos = gruposContato(clients, services, hoje)
  const vistos = new Set()
  const fila = []
  const por = (item) => {
    if (vistos.has(item.cliente.id)) return
    vistos.add(item.cliente.id)
    fila.push(item)
  }
  for (const item of grupos.garantia) {
    por({
      cliente: item.cliente,
      motivo: `Garantia ${textoPrazo(item.dias)}`,
      texto: msgGarantia(item.cliente.nome, item.servico.garantiaAte),
    })
  }
  for (const item of grupos.pos) {
    por({
      cliente: item.cliente,
      motivo: 'Verificar se o relógio está funcionando bem',
      texto: msgPos(item.cliente.nome),
    })
  }
  for (const item of grupos.sumidos) {
    por({
      cliente: item.cliente,
      motivo: `Sem retorno desde ${dataCurta(item.desde)}`,
      texto: msgRetorno(item.cliente.nome),
    })
  }
  return fila
}

function casaTexto(cliente, servs, texto) {
  const bruto = texto.trim()
  if (!bruto) return true
  const n = norm(bruto)
  const bloco = norm(
    [
      cliente.nome,
      cliente.endereco,
      cliente.numero,
      cliente.bairro,
      cliente.referencia,
      cliente.observacoes,
      cliente.telefone,
      cliente.cpf,
      ...servs.flatMap((s) => [s.tipo, s.marca, s.modelo, s.diagnostico, s.observacoes, s.pecas]),
    ].join(' '),
  )
  if (bloco.includes(n)) return true
  const d = digits(bruto)
  return d.length >= 3 && digits(cliente.telefone).includes(d)
}

export function filtrarClientes(clients, services, filtro) {
  const tipo = norm(filtro.tipo)
  return clients
    .filter((c) => {
      const servs = services.filter((s) => s.clienteId === c.id)
      if (!casaTexto(c, servs, filtro.texto || '')) return false
      if (!(tipo || filtro.de || filtro.ate)) return true
      return servs.some((s) => {
        if (tipo && norm(s.tipo) !== tipo) return false
        if (filtro.de && s.data < filtro.de) return false
        if (filtro.ate && s.data > filtro.ate) return false
        return true
      })
    })
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function filtrarServicos(services, clients, filtro) {
  const porId = new Map(clients.map((c) => [c.id, c]))
  const tipo = norm(filtro.tipo)
  const texto = norm(filtro.texto || '')
  const digitos = digits(filtro.texto || '')
  return services
    .filter((s) => {
      if (tipo && norm(s.tipo) !== tipo) return false
      if (filtro.de && s.data < filtro.de) return false
      if (filtro.ate && s.data > filtro.ate) return false
      if (!texto && digitos.length < 3) return true
      const c = porId.get(s.clienteId)
      const bloco = norm([c?.nome, c?.telefone, c?.cpf, c?.endereco, c?.numero, c?.bairro, c?.referencia, c?.observacoes, s.tipo, s.marca, s.modelo, s.diagnostico, s.observacoes, s.pecas].join(' '))
      if (texto && bloco.includes(texto)) return true
      return digitos.length >= 3 && digits(c?.telefone).includes(digitos)
    })
    .slice()
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.criadoEm < b.criadoEm ? 1 : -1))
}

export function resumo(clients, services, hoje) {
  const mes = hoje.slice(0, 7)
  const grupos = gruposContato(clients, services, hoje)
  const niver = aniversariantes(clients, hoje)
  let ativas = 0
  let aVencer = 0
  let vencidas = 0
  for (const s of services) {
    const st = statusGarantia(s, hoje)
    if (st === 'vigente' || st === 'avencer') ativas += 1
    if (st === 'avencer') aVencer += 1
    if (st === 'vencida') vencidas += 1
  }
  return {
    total: clients.length,
    novosMes: clients.filter((c) => (c.cadastro || '').startsWith(mes)).length,
    servicosMes: services.filter((s) => (s.data || '').startsWith(mes)).length,
    ativas,
    aVencer,
    vencidas,
    aniversarios: niver.mes.length,
    aniversariosHoje: niver.hoje.length,
    acompanhar: idsAcompanhar(grupos).size,
    grupos,
    niver,
  }
}

export function promissoriasDo(promissorias, clienteId) {
  return (promissorias || [])
    .filter((p) => p.clienteId === clienteId)
    .slice()
    .sort((a, b) => (a.dataVenda < b.dataVenda ? 1 : a.dataVenda > b.dataVenda ? -1 : 0))
}

export function financeiroProm(p, hoje) {
  const valor = Number(p?.valor || 0)
  const entrada = Number(p?.entrada || 0)
  const extra = (p?.pagamentos || []).reduce((acc, item) => acc + Number(item.valor || 0), 0)
  const pago = entrada + extra
  const saldo = Math.max(0, Math.round((valor - pago) * 100) / 100)
  let situacao = 'Em aberto'
  if (saldo <= 0.01) situacao = 'Quitada'
  else if (p?.vencimento && hoje && p.vencimento < hoje) situacao = 'Atrasada'
  else if (extra > 0) situacao = 'Parcial'
  return { valor, entrada, pago, saldo, situacao }
}

export function resumoPromissorias(promissorias, hoje) {
  let abertas = 0
  let atrasadas = 0
  let vendido = 0
  let recebido = 0
  let receber = 0
  for (const p of promissorias || []) {
    const fin = financeiroProm(p, hoje)
    vendido += fin.valor
    recebido += fin.pago
    if (fin.situacao !== 'Quitada') {
      abertas += 1
      receber += fin.saldo
    }
    if (fin.situacao === 'Atrasada') atrasadas += 1
  }
  return { abertas, atrasadas, vendido, recebido, receber }
}

export function valorExtenso(valor) {
  const n = Math.round(Number(valor || 0) * 100) / 100
  if (n <= 0) return 'Zero reais'
  const un = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const d1 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dz = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const ct = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
  function ate999(num) {
    if (num === 100) return 'cem'
    if (num < 10) return un[num]
    if (num < 20) return d1[num - 10]
    if (num < 100) return dz[Math.floor(num / 10)] + (num % 10 ? ' e ' + un[num % 10] : '')
    const c = Math.floor(num / 100)
    const r = num % 100
    return ct[c] + (r ? ' e ' + ate999(r) : '')
  }
  const inteiro = Math.floor(n)
  const cents = Math.round((n - inteiro) * 100)
  let s = ''
  if (inteiro > 0) {
    const mil = Math.floor(inteiro / 1000)
    const resto = inteiro % 1000
    if (mil) s = (mil === 1 ? 'um mil' : ate999(mil) + ' mil')
    if (resto) s += (s ? (resto < 100 ? ' e ' : ' ') : '') + ate999(resto)
    s += inteiro === 1 ? ' real' : ' reais'
  }
  if (cents) {
    const c = ate999(cents) + (cents === 1 ? ' centavo' : ' centavos')
    s = s ? s + ' e ' + c : c
  }
  return s.charAt(0).toUpperCase() + s.slice(1)
}
