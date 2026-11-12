import { useEffect, useMemo, useState } from 'react'
import { api, lerHub, salvarHub, sincronizarAgora } from './api.js'
import { Icon, IconeWhatsApp } from './icons.jsx'
import {
  JANELA_POS,
  addDays,
  dataCurta,
  diasEntre,
  filtrarClientes,
  filtrarServicos,
  filaContato,
  formatCpf,
  formatPhone,
  gruposContato,
  idade,
  linhaEndereco,
  md,
  nomeProprio,
  moeda,
  msgGarantia,
  msgNiver,
  msgPos,
  msgRetorno,
  primeiroNome,
  promissoriasDo,
  financeiroProm,
  resumo,
  resumoPromissorias,
  servicosDo,
  statusGarantia,
  textoPrazo,
  valorExtenso,
  waLink,
} from './logic.js'

function msgOi(nome) {
  return `Olá, seu ${primeiroNome(nome)}! Aqui é do Studio Seiko.`
}

function opcoesZap(cliente, services, hoje) {
  const lista = servicosDo(services, cliente.id)
  const recente = lista.some((s) => s.data >= addDays(hoje, -JANELA_POS) && s.data <= hoje)
  const nasc = md(cliente.nascimento)
  const garantia = lista.find((s) => statusGarantia(s, hoje) === 'avencer')
    || lista.find((s) => statusGarantia(s, hoje) === 'vigente')
  const ops = []
  if (recente) ops.push({ titulo: 'Pós-atendimento', texto: msgPos(cliente.nome), peso: 1 })
  if (garantia && statusGarantia(garantia, hoje) === 'avencer') {
    ops.push({ titulo: 'Garantia', texto: msgGarantia(cliente.nome, garantia.garantiaAte), peso: 0 })
  } else if (garantia) {
    ops.push({ titulo: 'Garantia', texto: msgGarantia(cliente.nome, garantia.garantiaAte), peso: 3 })
  }
  if (nasc && nasc.m === md(hoje).m) ops.push({ titulo: 'Aniversário', texto: msgNiver(cliente.nome), peso: 2 })
  if (gruposContato([cliente], services, hoje).sumidos.length) {
    ops.push({ titulo: 'Retorno', texto: msgRetorno(cliente.nome), peso: 2 })
  }
  if (!recente && lista.length) ops.push({ titulo: 'Pós-atendimento', texto: msgPos(cliente.nome), peso: 4 })
  if (!ops.length) ops.push({ titulo: 'Conversa', texto: msgOi(cliente.nome), peso: 5 })
  return ops.sort((a, b) => a.peso - b.peso)
}

function Zap({ telefone, opcoes, direto }) {
  const [aberto, setAberto] = useState(false)
  if (!telefone) return null
  if (direto || opcoes.length === 1) {
    const op = opcoes[0]
    return (
      <a className="btn zap-btn" href={waLink(telefone, op.texto)} target="_blank" rel="noreferrer">
        <IconeWhatsApp /> Falar
      </a>
    )
  }
  return (
    <div className="zap">
      <button type="button" className="btn zap-btn" onClick={() => setAberto((v) => !v)}>
        <IconeWhatsApp /> Falar
      </button>
      {aberto && (
        <div className="zap-menu">
          {opcoes.map((op) => (
            <a key={op.titulo} href={waLink(telefone, op.texto)} target="_blank" rel="noreferrer">
              <strong>{op.titulo}</strong>
              <span>{op.texto}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function Selo({ servico, hoje }) {
  const status = statusGarantia(servico, hoje)
  if (status === 'sem') return <span className="selo">Sem garantia</span>
  const dias = diasEntre(hoje, servico.garantiaAte)
  const texto = status === 'vigente'
    ? `Garantia até ${dataCurta(servico.garantiaAte)}`
    : `Garantia ${textoPrazo(dias)}`
  return <span className={`selo ${status}`}>{texto}</span>
}

function Vazio({ titulo, texto, acao }) {
  return (
    <div className="vazio">
      <strong>{titulo}</strong>
      <p>{texto}</p>
      {acao}
    </div>
  )
}

function obterIniciais(nome) {
  const limpo = String(nome || '').replace(/\(.*?\)/g, '').trim()
  const partes = limpo.split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function Pessoa({ cliente, classe }) {
  const iniciais = obterIniciais(cliente?.nome)
  return <span className={`avatar ${classe || ''}`} aria-hidden="true">{iniciais}</span>
}

export function Pagina({
  route, dados, hoje,
  abrirCliente, abrirServico, excluirCliente, excluirServico,
  abrirPromissoria, abrirPagamento, verPromissoria, imprimirPromissoria, excluirPromissoria,
  recarregar, avisar,
}) {
  const { clients, services, promissorias = [] } = dados
  if (route.name === 'ficha') {
    return (
      <Ficha
        id={route.id}
        clients={clients}
        services={services}
        promissorias={promissorias}
        hoje={hoje}
        abrirCliente={abrirCliente}
        abrirServico={abrirServico}
        excluirCliente={excluirCliente}
        excluirServico={excluirServico}
        abrirPromissoria={abrirPromissoria}
        abrirPagamento={abrirPagamento}
        verPromissoria={verPromissoria}
        imprimirPromissoria={imprimirPromissoria}
      />
    )
  }
  if (route.name === 'clientes') {
    return <Clientes clients={clients} services={services} hoje={hoje} abrirCliente={abrirCliente} />
  }
  if (route.name === 'promissorias') {
    return (
      <Promissorias
        clients={clients}
        promissorias={promissorias}
        hoje={hoje}
        abrirPromissoria={abrirPromissoria}
        verPromissoria={verPromissoria}
      />
    )
  }
  if (route.name === 'servicos') {
    return <Servicos clients={clients} services={services} hoje={hoje} abrirServico={abrirServico} />
  }
  if (route.name === 'garantias') return <Garantias clients={clients} services={services} hoje={hoje} />
  if (route.name === 'aniversarios') return <Aniversarios clients={clients} hoje={hoje} />
  if (route.name === 'contatos') return <Contatos clients={clients} services={services} hoje={hoje} />
  if (route.name === 'ajustes') return <Ajustes dados={dados} recarregar={recarregar} avisar={avisar} />
  return (
    <Painel
      clients={clients}
      services={services}
      promissorias={promissorias}
      hoje={hoje}
      abrirCliente={abrirCliente}
      abrirServico={abrirServico}
      abrirPromissoria={abrirPromissoria}
    />
  )
}

function SeloProm({ p, hoje }) {
  const fin = financeiroProm(p, hoje)
  const cls = fin.situacao === 'Quitada' ? 'vigente' : fin.situacao === 'Atrasada' ? 'vencida' : fin.situacao === 'Parcial' ? 'avencer' : ''
  return <span className={`selo ${cls}`}>{fin.situacao}</span>
}

function classeSaldoProm(fin) {
  if (fin.situacao === 'Quitada') return 'txt-quitado'
  if (fin.situacao === 'Atrasada') return 'txt-devendo'
  return 'txt-aberto'
}

function moedaCurta(n) {
  const v = Math.round(Number(n || 0))
  if (v >= 1000) {
    const mil = v / 1000
    const txt = mil >= 10 ? String(Math.round(mil)) : mil.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return `R$ ${txt} mil`
  }
  return `R$ ${v.toLocaleString('pt-BR')}`
}

function curvaSuave(pontos, chave) {
  let d = `M ${pontos[0].x} ${pontos[0][chave]}`
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i]
    const p1 = pontos[i + 1]
    const cpX = p0.x + (p1.x - p0.x) / 2
    d += ` C ${cpX} ${p0[chave]}, ${cpX} ${p1[chave]}, ${p1.x} ${p1[chave]}`
  }
  return d
}

const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function somaMes(promissorias, prefixo) {
  let vendido = 0
  let recebido = 0
  for (const p of promissorias) {
    if ((p.dataVenda || '').startsWith(prefixo)) {
      vendido += Number(p.valor || 0)
      recebido += Number(p.entrada || 0)
    }
    for (const pag of p.pagamentos || []) {
      if ((pag.data || '').startsWith(prefixo)) recebido += Number(pag.valor || 0)
    }
  }
  return {
    vendido: Math.round(vendido * 100) / 100,
    recebido: Math.round(recebido * 100) / 100,
  }
}

function GraficoPanorama({ promissorias = [], hoje }) {
  const [periodo, setPeriodo] = useState('6')
  const anos = useMemo(() => {
    const set = new Set()
    const atual = String(hoje || '').slice(0, 4)
    if (/^\d{4}$/.test(atual)) set.add(atual)
    for (const p of promissorias) {
      const venda = (p.dataVenda || '').slice(0, 4)
      if (/^\d{4}$/.test(venda)) set.add(venda)
      for (const pag of p.pagamentos || []) {
        const pago = (pag.data || '').slice(0, 4)
        if (/^\d{4}$/.test(pago)) set.add(pago)
      }
    }
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [promissorias, hoje])
  const dadosMeses = useMemo(() => {
    const [anoAtual, mesAtual] = String(hoje || '').split('-').map(Number)
    if (periodo !== '6') {
      return NOMES_MES.map((mes, i) => ({
        mes,
        ...somaMes(promissorias, `${periodo}-${String(i + 1).padStart(2, '0')}`),
      }))
    }
    const lista = []
    for (let i = 5; i >= 0; i--) {
      let m = mesAtual - i
      let y = anoAtual
      while (m <= 0) {
        m += 12
        y -= 1
      }
      lista.push({
        mes: NOMES_MES[m - 1],
        ...somaMes(promissorias, `${y}-${String(m).padStart(2, '0')}`),
      })
    }
    return lista
  }, [promissorias, hoje, periodo])

  const max = Math.max(...dadosMeses.flatMap((d) => [d.vendido, d.recebido]), 1)
  const padX = 4
  const padTop = 16
  const padBottom = 8
  const innerH = 100 - padTop - padBottom
  const pontos = dadosMeses.map((d, i) => ({
    x: padX + (i / (dadosMeses.length - 1)) * (100 - padX * 2),
    yVenda: padTop + (1 - d.vendido / max) * innerH,
    yRecebe: padTop + (1 - d.recebido / max) * innerH,
    ...d,
  }))
  const linhaVenda = curvaSuave(pontos, 'yVenda')
  const linhaRecebe = curvaSuave(pontos, 'yRecebe')
  const areaVenda = `${linhaVenda} L ${pontos[pontos.length - 1].x} 100 L ${pontos[0].x} 100 Z`
  const picoVenda = dadosMeses.reduce((melhor, d) => (d.vendido >= (melhor?.vendido || 0) ? d : melhor))
  const picoRecebe = dadosMeses.reduce((melhor, d) => (d.recebido >= (melhor?.recebido || 0) ? d : melhor))

  return (
    <section className="card card-grafico">
      <header className="card-head">
        <div>
          <h2>Panorama do mês</h2>
          <p>
            {picoVenda.vendido > 0 ? `Mais vendeu: ${picoVenda.mes} (${moeda(picoVenda.vendido)})` : 'Sem vendas nestes meses'}
            {picoRecebe.recebido > 0 ? ` · Mais entrou: ${picoRecebe.mes} (${moeda(picoRecebe.recebido)})` : ''}
          </p>
        </div>
        <div className="grafico-topo-acoes">
          <div className="grafico-legenda-dots" aria-hidden="true">
            <span className="dot-legenda"><i className="dot-ico gold" /> Vendido</span>
            <span className="dot-legenda"><i className="dot-ico verde" /> Recebido</span>
          </div>
          <select className="badge-tag grafico-ano" value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período do gráfico">
            <option value="6">Últimos 6 meses</option>
            {anos.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
          </select>
        </div>
      </header>
      <div className="grafico-stage">
        <div className="grafico-svg-wrap">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="grafico-svg">
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4af37" stopOpacity="0.32" />
                <stop offset="70%" stopColor="#d4af37" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#d4af37" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(255,255,255,0.035)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1="65" x2="100" y2="65" stroke="rgba(255,255,255,0.035)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <path d={areaVenda} fill="url(#goldGrad)" />
            <path d={linhaVenda} fill="none" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={linhaRecebe} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="grafico-pontos-layer" aria-hidden="true">
            {pontos.map((p) => (
              <div key={p.mes}>
                <div className="grafico-ponto-wrap" style={{ left: `${p.x}%`, top: `${p.yVenda}%` }} title={`${p.mes}: vendeu ${moeda(p.vendido)}`}>
                  <span className="grafico-ponto-dot" />
                </div>
                <div className="grafico-ponto-wrap" style={{ left: `${p.x}%`, top: `${p.yRecebe}%` }} title={`${p.mes}: entrou ${moeda(p.recebido)}`}>
                  <span className="grafico-ponto-dot verde" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={periodo === '6' ? 'grafico-meses-legenda' : 'grafico-meses-legenda cheio'}>
          {dadosMeses.map((d) => (
            <div key={d.mes} className="grafico-mes-col">
              <span className="grafico-mes-nome">{d.mes}</span>
              <small className="grafico-mes-total venda">{moedaCurta(d.vendido)}</small>
              <small className="grafico-mes-total entrada">{moedaCurta(d.recebido)}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Painel({ clients, services, promissorias = [], hoje, abrirCliente, abrirServico, abrirPromissoria }) {
  const info = resumo(clients, services, hoje)
  const fin = resumoPromissorias(promissorias, hoje)
  const fila = filaContato(clients, services, hoje).slice(0, 4)
  const recentes = clients
    .slice()
    .sort((a, b) => (a.cadastro < b.cadastro ? 1 : a.cadastro > b.cadastro ? -1 : a.criadoEm < b.criadoEm ? 1 : -1))
    .slice(0, 6)

  function ultimaCompra(c) {
    const nota = promissoriasDo(promissorias, c.id)[0]
    if (nota?.produto) return { texto: nota.produto, data: nota.dataVenda }
    const servico = servicosDo(services, c.id)[0]
    if (servico?.tipo) return { texto: servico.tipo, data: servico.data }
    return { texto: '', data: c.cadastro }
  }

  // 4 KPIs nobres principais
  const kpisNobres = [
    { href: '#/promissorias', icon: 'cash', label: 'Total vendido', valor: moeda(fin.vendido), sub: `${fin.abertas} promissórias em aberto`, tag: 'Vendas' },
    { href: '#/servicos', icon: 'wrench', label: 'Serviços no mês', valor: info.servicosMes, sub: 'atendimentos neste mês', tag: 'Ativo' },
    { href: '#/clientes', icon: 'users', label: 'Clientes cadastrados', valor: info.total, sub: `+${info.novosMes} novos este mês`, tag: 'Base' },
    { href: '#/garantias', icon: 'shield', label: 'Garantias ativas', valor: info.ativas, sub: `${info.aVencer} a vencer em 15 dias`, tag: 'Vigentes' },
  ]

  return (
    <div>
      {info.aniversariosHoje > 0 && (
        <a className="faixa" href="#/aniversarios">
          {info.aniversariosHoje === 1
            ? `${info.niver.hoje[0].nome} faz aniversário hoje`
            : `${info.aniversariosHoje} clientes fazem aniversário hoje`}
        </a>
      )}
      <section className="kpis">
        {kpisNobres.map((card) => (
          <a key={card.label} className="kpi" href={card.href}>
            <span className="kpi-ico"><Icon name={card.icon} /></span>
            <span className="kpi-label">{card.label}</span>
            <span className="kpi-tag">{card.tag}</span>
            <strong>{card.valor}</strong>
            <em>{card.sub}</em>
          </a>
        ))}
      </section>

      {/* Faixa sintética de métricas complementares */}
      <div className="kpis-secundarios">
        <a href="#/promissorias"><span>Recebido:</span> <b>{moeda(fin.recebido)}</b></a>
        <a href="#/promissorias"><span>A receber:</span> <b className="txt-devendo">{moeda(fin.receber)}</b></a>
        <a href="#/aniversarios"><span>Aniversariantes:</span> <b>{info.aniversarios} no mês</b></a>
        <a href="#/contatos"><span>Contatos:</span> <b>{info.acompanhar} para acompanhar</b></a>
        {info.vencidas > 0 && <a href="#/garantias"><b className="txt-devendo">{info.vencidas} garantia(s) vencida(s)</b></a>}
      </div>

      <div className="home">
        <div className="col">
          <GraficoPanorama promissorias={promissorias} hoje={hoje} />
          <section className="card">
            <header className="card-head">
              <h2>Últimos clientes cadastrados</h2>
              <a href="#/clientes">Ver todos os clientes</a>
            </header>
            {recentes.length === 0 ? (
              <Vazio titulo="Nenhum cliente ainda" texto="O primeiro cadastro aparece aqui." acao={<button type="button" className="btn gold" onClick={() => abrirCliente()}>Novo cliente</button>} />
            ) : (
              <>
                <div className="table-desktop">
                  <table>
                    <thead>
                      <tr><th>Nome</th><th>Telefone</th><th>Produto</th><th>Data</th></tr>
                    </thead>
                    <tbody>
                      {recentes.map((c) => {
                        const compra = ultimaCompra(c)
                        return (
                          <tr key={c.id}>
                            <td><a className="nome" href={`#/clientes/${c.id}`}><Pessoa cliente={c} />{c.nome}</a></td>
                            <td>{formatPhone(c.telefone)}</td>
                            <td>{compra.texto || '—'}</td>
                            <td>{dataCurta(compra.data)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="list-mobile">
                  {recentes.map((c) => {
                    const compra = ultimaCompra(c)
                    return (
                      <a key={c.id} href={`#/clientes/${c.id}`}>
                        <Pessoa cliente={c} />
                        <span>
                          <strong>{c.nome}</strong>
                          <small>{compra.texto || 'Sem compra'} · {dataCurta(compra.data)}</small>
                        </span>
                      </a>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </div>
        <div className="col">
          <section className="card">
            <header className="card-head">
              <h2>Clientes para contato</h2>
              <a href="#/contatos">Ver todos</a>
            </header>
            {fila.length === 0 ? (
              <p className="muted">Ninguém precisa de contato agora.</p>
            ) : (
              <ul className="contato-lista">
                {fila.map((item) => (
                  <li key={item.cliente.id}>
                    <a href={`#/clientes/${item.cliente.id}`}><Pessoa cliente={item.cliente} /></a>
                    <div>
                      <a href={`#/clientes/${item.cliente.id}`}>{item.cliente.nome}</a>
                      <small>{item.motivo}</small>
                    </div>
                    <Zap telefone={item.cliente.telefone} opcoes={[{ titulo: 'Falar', texto: item.texto }]} direto />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <header className="card-head"><h2>Ações rápidas</h2></header>
            <div className="acoes">
              <button type="button" onClick={() => abrirCliente()}><Icon name="plus" />Novo cliente</button>
              <button type="button" onClick={() => abrirServico()}><Icon name="wrench" />Novo serviço</button>
              <button type="button" onClick={() => abrirPromissoria()}><Icon name="note" />Nova promissória</button>
              <a href="#/promissorias"><Icon name="note" />Ver promissórias</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Filtros({ filtro, setFiltro, tipos, mostrarTipo }) {
  return (
    <div className="filtros">
      <label>
        <span>Pesquisar</span>
        <input value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} placeholder="Nome, telefone, endereço ou observação" />
      </label>
      {mostrarTipo && (
        <label>
          <span>Tipo de serviço</span>
          <select value={filtro.tipo} onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })}>
            <option value="">Todos</option>
            {tipos.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
        </label>
      )}
      <label>
        <span>De</span>
        <input type="date" value={filtro.de} onChange={(e) => setFiltro({ ...filtro, de: e.target.value })} />
      </label>
      <label>
        <span>Até</span>
        <input type="date" value={filtro.ate} onChange={(e) => setFiltro({ ...filtro, ate: e.target.value })} />
      </label>
    </div>
  )
}

function Clientes({ clients, services, hoje, abrirCliente }) {
  const [filtro, setFiltro] = useState({ texto: '', tipo: '', de: '', ate: '' })
  const tipos = useMemo(() => [...new Set(services.map((s) => s.tipo))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [services])
  const lista = filtrarClientes(clients, services, filtro)

  return (
    <section>
      <header className="page-head">
        <div>
          <h2>Clientes</h2>
          <p>{lista.length} de {clients.length}</p>
        </div>
        <div className="row-btns">
          <a className="btn ghost" href="/api/export/clientes.csv">Exportar CSV</a>
          <button type="button" className="btn gold" onClick={() => abrirCliente()}>Novo cliente</button>
        </div>
      </header>
      <Filtros filtro={filtro} setFiltro={setFiltro} tipos={tipos} mostrarTipo />
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum cliente encontrado" texto="Cadastre um cliente ou ajuste a pesquisa." acao={<button type="button" className="btn gold" onClick={() => abrirCliente()}>Novo cliente</button>} />
      ) : (
        <ul className="lista">
          {lista.map((c) => {
            const ultimo = servicosDo(services, c.id)[0]
            return (
              <li key={c.id}>
                <a className="lista-main" href={`#/clientes/${c.id}`}>
                  <Pessoa cliente={c} />
                  <span>
                    <strong>{c.nome}</strong>
                    <small>{formatPhone(c.telefone)} · {ultimo ? `${ultimo.tipo} em ${dataCurta(ultimo.data)}` : 'Sem serviço'}</small>
                  </span>
                </a>
                <Zap telefone={c.telefone} opcoes={opcoesZap(c, services, hoje)} direto />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Ficha({
  id, clients, services, promissorias = [], hoje,
  abrirCliente, abrirServico, excluirCliente, excluirServico,
  abrirPromissoria, abrirPagamento, verPromissoria, imprimirPromissoria,
}) {
  const cliente = clients.find((c) => c.id === id)
  if (!cliente) {
    return <Vazio titulo="Cliente não encontrado" texto="Esse cadastro não está mais na lista." acao={<a className="btn gold" href="#/clientes">Voltar</a>} />
  }
  const lista = servicosDo(services, cliente.id)
  const notas = promissoriasDo(promissorias, cliente.id)
  const anos = idade(cliente.nascimento, hoje)
  const ops = opcoesZap(cliente, services, hoje)

  return (
    <section>
      <a className="voltar" href="#/clientes">Clientes</a>
      <header className="ficha-top">
        <div>
          <h2>{cliente.nome}</h2>
          <p>{formatPhone(cliente.telefone)}</p>
        </div>
        <div className="row-btns">
          <Zap telefone={cliente.telefone} opcoes={ops} />
          <button type="button" className="btn ghost" onClick={() => abrirCliente(cliente)}>Editar</button>
          <button type="button" className="btn danger" onClick={() => excluirCliente(cliente)}>Excluir</button>
        </div>
      </header>
      <div className="ficha-grid">
        <article className="card dados">
          <p><span>Telefone</span>{formatPhone(cliente.telefone) || 'Não informado'}</p>
          <p><span>CPF</span>{formatCpf(cliente.cpf) || 'Não informado'}</p>
          <p><span>Endereço</span>{cliente.endereco || 'Não informado'}</p>
          {cliente.numero ? <p><span>Número</span>{cliente.numero}</p> : null}
          {cliente.bairro ? <p><span>Bairro</span>{cliente.bairro}</p> : null}
          {cliente.referencia ? <p><span>Ponto de referência</span>{cliente.referencia}</p> : null}
          <p><span>Nascimento</span>{cliente.nascimento ? `${dataCurta(cliente.nascimento)}${anos != null ? ` · ${anos} anos` : ''}` : 'Não informado'}</p>
          <p><span>Cliente desde</span>{dataCurta(cliente.cadastro)}</p>
          {cliente.observacoes && <p><span>Observações</span>{cliente.observacoes}</p>}
        </article>
        <div>
          <header className="page-head fino">
            <h3>Histórico de serviços</h3>
            <button type="button" className="btn gold" onClick={() => abrirServico(cliente.id)}>Novo serviço</button>
          </header>
          {lista.length === 0 ? (
            <Vazio titulo="Nenhum serviço ainda" texto="O histórico guarda cada atendimento, sem apagar os anteriores." />
          ) : (
            <ol className="timeline">
              {lista.map((s) => (
                <li key={s.id} className="card">
                  <header>
                    <div>
                      <strong>{s.tipo}</strong>
                      <small>{dataCurta(s.data)}{s.marca || s.modelo ? ` · ${[s.marca, s.modelo].filter(Boolean).join(' ')}` : ''}</small>
                    </div>
                    <Selo servico={s} hoje={hoje} />
                  </header>
                  <p className="valor">{moeda(s.valor)}</p>
                  {s.pecas && <p><span>Peças</span>{s.pecas}</p>}
                  {s.diagnostico && <p><span>Diagnóstico</span>{s.diagnostico}</p>}
                  {s.observacoes && <p><span>Observações</span>{s.observacoes}</p>}
                  <div className="row-btns">
                    <button type="button" className="btn ghost" onClick={() => abrirServico(cliente.id, s)}>Editar</button>
                    <button type="button" className="btn danger" onClick={() => excluirServico(s)}>Excluir</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <header className="page-head fino" style={{ marginTop: 22 }}>
            <h3>Promissórias</h3>
            <button type="button" className="btn gold" onClick={() => abrirPromissoria(cliente.id)}>Nova promissória</button>
          </header>
          {notas.length === 0 ? (
            <Vazio titulo="Nenhuma promissória" texto="A venda a prazo deste cliente aparece aqui." />
          ) : (
            <ul className="lista">
              {notas.map((p) => {
                const fin = financeiroProm(p, hoje)
                return (
                  <li key={p.id}>
                    <button type="button" className="lista-main" onClick={() => verPromissoria(p)}>
                      <strong>{p.produto}</strong>
                      <small>{dataCurta(p.dataVenda)}</small>
                    </button>
                    <span className="lista-saldo">
                      <small>Devendo</small>
                      <b className={classeSaldoProm(fin)}>{moeda(fin.saldo)}</b>
                    </span>
                    <SeloProm p={p} hoje={hoje} />
                    {fin.saldo > 0.01 && (
                      <button type="button" className="btn ghost" onClick={() => abrirPagamento(p)}>Pagar</button>
                    )}
                    <button type="button" className="btn ghost" onClick={() => imprimirPromissoria(p)}>Nota</button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function Promissorias({ clients, promissorias, hoje, abrirPromissoria, verPromissoria }) {
  const [texto, setTexto] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const porId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const totais = useMemo(() => {
    let atrasadas = 0
    let abertas = 0
    let quitadas = 0
    for (const p of promissorias || []) {
      const s = financeiroProm(p, hoje).situacao
      if (s === 'Atrasada') atrasadas += 1
      else if (s === 'Quitada') quitadas += 1
      else abertas += 1
    }
    return { todas: (promissorias || []).length, atrasadas, abertas, quitadas }
  }, [promissorias, hoje])
  const lista = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return (promissorias || [])
      .map((p) => ({ p, fin: financeiroProm(p, hoje) }))
      .filter(({ p, fin }) => {
        if (filtro === 'atrasadas' && fin.situacao !== 'Atrasada') return false
        if (filtro === 'abertas' && fin.situacao !== 'Em aberto' && fin.situacao !== 'Parcial') return false
        if (filtro === 'quitadas' && fin.situacao !== 'Quitada') return false
        if (!q) return true
        const c = porId.get(p.clienteId)
        return [c?.nome, c?.telefone, c?.cpf, c?.endereco, c?.numero, c?.bairro, c?.referencia, c?.observacoes, p.produto, p.observacoes].join(' ').toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (filtro === 'todas') return a.p.dataVenda < b.p.dataVenda ? 1 : a.p.dataVenda > b.p.dataVenda ? -1 : 0
        return a.p.dataVenda < b.p.dataVenda ? -1 : a.p.dataVenda > b.p.dataVenda ? 1 : 0
      })
  }, [promissorias, hoje, texto, filtro, porId])

  return (
    <section>
      <header className="page-head">
        <div>
          <h2>Promissórias</h2>
          <p>
            {lista.length} título{lista.length === 1 ? '' : 's'}
            {filtro !== 'todas' ? ' · mais antiga no topo' : ' a prazo'}
          </p>
        </div>
        <button type="button" className="btn gold" onClick={() => abrirPromissoria()}>Nova promissória</button>
      </header>
      <div className="abas">
        <button type="button" className={filtro === 'todas' ? 'on' : ''} onClick={() => setFiltro('todas')}>Todas {totais.todas}</button>
        <button type="button" className={filtro === 'atrasadas' ? 'on' : ''} onClick={() => setFiltro('atrasadas')}>Atrasadas {totais.atrasadas}</button>
        <button type="button" className={filtro === 'abertas' ? 'on' : ''} onClick={() => setFiltro('abertas')}>Em aberto {totais.abertas}</button>
        <button type="button" className={filtro === 'quitadas' ? 'on' : ''} onClick={() => setFiltro('quitadas')}>Quitadas {totais.quitadas}</button>
      </div>
      <div className="filtros">
        <label>
          <span>Pesquisar</span>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cliente, produto, endereço ou observação" />
        </label>
      </div>
      {lista.length === 0 ? (
        <Vazio
          titulo={filtro === 'todas' ? 'Nenhuma promissória ainda' : `Nenhuma ${filtro === 'atrasadas' ? 'atrasada' : filtro === 'abertas' ? 'em aberto' : 'quitada'}`}
          texto={filtro === 'todas' ? 'Registre uma venda a prazo pela ficha do cliente.' : 'Tente outro filtro ou a pesquisa.'}
          acao={filtro === 'todas' ? <button type="button" className="btn gold" onClick={() => abrirPromissoria()}>Nova promissória</button> : null}
        />
      ) : (
        <ul className="lista">
          {lista.map(({ p, fin }) => {
            const c = porId.get(p.clienteId)
            return (
              <li key={p.id}>
                <button type="button" className="lista-main" onClick={() => verPromissoria(p)}>
                  <Pessoa
                    cliente={c || { nome: '?' }}
                    classe={fin.situacao === 'Quitada' ? 'quitado' : fin.situacao === 'Atrasada' ? 'atrasado' : 'aberto'}
                  />
                  <span>
                    <strong className={fin.situacao === 'Quitada' ? 'nome-quitada' : ''}>{c?.nome || 'Cliente removido'}</strong>
                    <small>{p.produto} · {dataCurta(p.dataVenda)}</small>
                  </span>
                </button>
                <span className="lista-saldo">
                  <small>Devendo</small>
                  <b className={classeSaldoProm(fin)}>{moeda(fin.saldo)}</b>
                </span>
                <SeloProm p={p} hoje={hoje} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function itensDaProm(p) {
  if ((p?.itens || []).length) return p.itens
  if (p?.produto) return [{ produto: p.produto, valor: Number(p.valor) || 0 }]
  return []
}

export function DetalhePromissoria({ p, cliente, hoje, onPagar, onAdicionarProduto, onEditarProduto, onImprimir, onEditar, onExcluir, onExcluirPagamento, onExcluirEntrada, onExcluirProduto, onClose, onClienteSalvo }) {
  const fin = financeiroProm(p, hoje)
  const itens = itensDaProm(p)
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [f, setF] = useState(null)

  function comecar() {
    if (!cliente) return
    setF({
      nome: cliente.nome || '',
      telefone: formatPhone(cliente.telefone || ''),
      cpf: formatCpf(cliente.cpf || ''),
      endereco: cliente.endereco || '',
    })
    setErro('')
    setEditando(true)
  }

  async function salvarCliente() {
    if (!cliente || !f) return
    if (f.nome.trim().length < 3) {
      setErro('Informe o nome completo')
      return
    }
    setOcupado(true)
    setErro('')
    try {
      await api(`/api/clients/${cliente.id}`, {
        method: 'PUT',
        body: {
          nome: f.nome,
          telefone: f.telefone,
          cpf: f.cpf,
          endereco: f.endereco,
          numero: cliente.numero || '',
          bairro: cliente.bairro || '',
          referencia: cliente.referencia || '',
          nascimento: cliente.nascimento || '',
          cadastro: cliente.cadastro,
          observacoes: cliente.observacoes || '',
        },
      })
      await onClienteSalvo?.()
      setEditando(false)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="form detalhe-prom">
      <article className="resumo-prom">
        <p className="largo">
          <span>Cliente</span>
          <span className="linha-edit">
            {editando ? <input value={f.nome} onChange={(e) => setF({ ...f, nome: nomeProprio(e.target.value) })} maxLength={120} autoFocus /> : (cliente?.nome || '—')}
            {cliente && (
              <span className="acoes-inline">
                <button type="button" className="btn ghost mini" onClick={comecar}>Editar</button>
                <button type="button" className="btn gold mini" onClick={salvarCliente} disabled={!editando || ocupado}>{ocupado ? 'Salvando...' : 'Salvar'}</button>
              </span>
            )}
          </span>
        </p>
        <p>
          <span>Telefone</span>
          {editando ? <input value={f.telefone} onChange={(e) => setF({ ...f, telefone: formatPhone(e.target.value) })} inputMode="tel" /> : (formatPhone(cliente?.telefone) || 'Não informado')}
        </p>
        <p>
          <span>CPF</span>
          {editando ? <input value={f.cpf} onChange={(e) => setF({ ...f, cpf: formatCpf(e.target.value) })} inputMode="numeric" /> : (formatCpf(cliente?.cpf) || 'Não informado')}
        </p>
        <p className="largo">
          <span>Endereço</span>
          {editando ? <input value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} maxLength={180} /> : (linhaEndereco(cliente) || 'Não informado')}
        </p>
        <p><span>Venda</span>{dataCurta(p.dataVenda)} · vence {dataCurta(p.vencimento)}</p>
        <p><span>Valor</span>{moeda(fin.valor)}</p>
        <p><span>Recebido</span>{moeda(fin.pago)}</p>
        <p><span>Devendo</span><b className={classeSaldoProm(fin)}>{moeda(fin.saldo)} · {fin.situacao}</b></p>
        {cliente?.observacoes ? <p className="largo"><span>Observações</span>{cliente.observacoes}</p> : null}
        {erro ? <p className="largo erro">{erro}</p> : null}
      </article>
      <div className="secao-linha">
        <h3>Produtos</h3>
        <button type="button" className="link" onClick={onAdicionarProduto}>Adicionar</button>
      </div>
      {itens.length === 0 ? (
        <p className="muted">Nenhum produto nesta venda.</p>
      ) : (
        <ul className="lista plain">
          {itens.map((item, i) => (
            <li key={`${item.produto}-${i}`}>
              <span><strong>{item.produto}</strong></span>
              <span className="pag-valor">
                <strong>{moeda(item.valor)}</strong>
                <button type="button" className="link" onClick={() => onEditarProduto(item, i)}>Editar</button>
                <button type="button" className="btn-x" aria-label="Excluir produto" onClick={() => onExcluirProduto(item, i)}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <h3>Pagamentos</h3>
      {(p.pagamentos || []).length === 0 && Number(p.entrada || 0) <= 0 ? (
        <p className="muted">Nenhum pagamento ainda.</p>
      ) : (
        <ul className="lista plain">
          {Number(p.entrada || 0) > 0 && (
            <li>
              <span><strong>Entrada</strong><small>{dataCurta(p.dataVenda)}</small></span>
              <span className="pag-valor"><strong>{moeda(p.entrada)}</strong><button type="button" className="btn-x" aria-label="Excluir entrada" onClick={onExcluirEntrada}>×</button></span>
            </li>
          )}
          {(p.pagamentos || []).map((item) => (
            <li key={item.id}>
              <span><strong>{item.forma || 'Pagamento'}</strong><small>{dataCurta(item.data)}</small></span>
              <span className="pag-valor"><strong>{moeda(item.valor)}</strong><button type="button" className="btn-x" aria-label="Excluir pagamento" onClick={() => onExcluirPagamento(item)}>×</button></span>
            </li>
          ))}
        </ul>
      )}
      <div className="row-btns fim">
        <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
        <button type="button" className="btn ghost" onClick={onEditar}>Editar</button>
        {fin.saldo > 0.01 && <button type="button" className="btn gold" onClick={onPagar}>Adicionar valor</button>}
        <button type="button" className="btn gold" onClick={onImprimir}>Ver nota</button>
        {cliente?.telefone ? (
          <a className="btn zap-btn" href={waLink(cliente.telefone, msgOi(cliente.nome))} target="_blank" rel="noreferrer">
            <IconeWhatsApp /> WhatsApp
          </a>
        ) : null}
        <button type="button" className="btn danger" onClick={onExcluir}>Excluir</button>
      </div>
    </div>
  )
}

export function FolhaNota({ p, cliente, credor, hoje }) {
  if (!p || !cliente) return null
  const fin = financeiroProm(p, hoje)
  const cobrado = fin.saldo > 0.01 ? fin.saldo : fin.valor
  const credorNome = credor?.nome || 'Studio Seiko'
  const cidade = credor?.cidade || 'Cururupu-MA'
  return (
    <div className="folha-print">
      <div className="nota-prom">
        <header>
          <strong>NOTA PROMISSÓRIA</strong>
          <span>Nº {String(p.id).slice(-6).toUpperCase()} · Vencimento {dataCurta(p.vencimento)} · {moeda(cobrado)}</span>
        </header>
        <p>
          No dia {dataCurta(p.vencimento)}, pagarei por esta única via de Nota Promissória a <b>{credorNome}</b>
          {credor?.documento ? <>, inscrito no CPF/CNPJ {credor.documento}</> : null},
          ou à sua ordem, a quantia de <b>{valorExtenso(cobrado)}</b>, em moeda corrente deste país,
          pagável na praça de {cidade}.
        </p>
        <p>Esta nota vincula-se ao produto: <b>{p.produto}</b>.</p>
        <div className="nota-assin">
          <div>
            <h4>Emitente (Devedor)</h4>
            <p>{cliente.nome}</p>
            <p>{formatPhone(cliente.telefone)}</p>
            <p>{[cliente.endereco, cliente.numero ? `nº ${cliente.numero}` : '', cliente.bairro].filter(Boolean).join(', ')}</p>
            {cliente.referencia ? <p>Ref: {cliente.referencia}</p> : null}
            <em>Assinatura</em>
          </div>
          <div>
            <h4>Beneficiário</h4>
            <p>{credorNome}</p>
            <p>{cidade}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Servicos({ clients, services, hoje, abrirServico }) {
  const [filtro, setFiltro] = useState({ texto: '', tipo: '', de: '', ate: '' })
  const tipos = useMemo(() => [...new Set(services.map((s) => s.tipo))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [services])
  const porId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const lista = filtrarServicos(services, clients, filtro)

  return (
    <section>
      <header className="page-head">
        <div>
          <h2>Serviços</h2>
          <p>{lista.length} atendimento{lista.length === 1 ? '' : 's'}</p>
        </div>
        <div className="row-btns">
          <a className="btn ghost" href="/api/export/servicos.csv">Exportar CSV</a>
          <button type="button" className="btn gold" onClick={() => abrirServico()}>Novo serviço</button>
        </div>
      </header>
      <Filtros filtro={filtro} setFiltro={setFiltro} tipos={tipos} mostrarTipo />
      {lista.length === 0 ? (
        <Vazio titulo="Nenhum serviço encontrado" texto="Registre um atendimento pela ficha do cliente." />
      ) : (
        <ul className="lista">
          {lista.map((s) => {
            const c = porId.get(s.clienteId)
            return (
              <li key={s.id}>
                <a className="lista-main" href={`#/clientes/${s.clienteId}`}>
                  <span>
                    <strong>{s.tipo}</strong>
                    <small>{c?.nome || 'Cliente removido'} · {[s.marca, s.modelo].filter(Boolean).join(' ') || 'Relógio não informado'} · {dataCurta(s.data)} · {moeda(s.valor)}</small>
                  </span>
                </a>
                <Selo servico={s} hoje={hoje} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Garantias({ clients, services, hoje }) {
  const [aba, setAba] = useState('ativas')
  const porId = new Map(clients.map((c) => [c.id, c]))
  const itens = services
    .filter((s) => statusGarantia(s, hoje) !== 'sem')
    .map((s) => ({ s, status: statusGarantia(s, hoje), cliente: porId.get(s.clienteId), dias: diasEntre(hoje, s.garantiaAte) }))
    .sort((a, b) => a.s.garantiaAte < b.s.garantiaAte ? -1 : 1)
  const visiveis = itens.filter((item) => {
    if (aba === 'ativas') return item.status === 'vigente' || item.status === 'avencer'
    if (aba === 'avencer') return item.status === 'avencer'
    return item.status === 'vencida'
  })
  const contagem = {
    ativas: itens.filter((i) => i.status !== 'vencida').length,
    avencer: itens.filter((i) => i.status === 'avencer').length,
    vencida: itens.filter((i) => i.status === 'vencida').length,
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h2>Garantias</h2>
          <p>O vencimento sai da data do serviço mais o prazo de cada atendimento.</p>
        </div>
      </header>
      <div className="abas" role="tablist">
        {[
          ['ativas', `Ativas (${contagem.ativas})`],
          ['avencer', `A vencer (${contagem.avencer})`],
          ['vencida', `Vencidas (${contagem.vencida})`],
        ].map(([id, rotulo]) => (
          <button type="button" key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'on' : ''} onClick={() => setAba(id)}>{rotulo}</button>
        ))}
      </div>
      {visiveis.length === 0 ? (
        <Vazio titulo="Nada nesta lista" texto="Quando um serviço tiver prazo, a garantia aparece aqui." />
      ) : (
        <ul className="lista">
          {visiveis.map(({ s, cliente, dias }) => (
            <li key={s.id}>
              <a className="lista-main" href={`#/clientes/${s.clienteId}`}>
                <span>
                  <strong>{cliente?.nome || 'Cliente removido'}</strong>
                  <small>{s.tipo} · até {dataCurta(s.garantiaAte)} · {textoPrazo(dias)}</small>
                </span>
              </a>
              {cliente && <Zap telefone={cliente.telefone} opcoes={[{ titulo: 'Garantia', texto: msgGarantia(cliente.nome, s.garantiaAte) }]} direto />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Aniversarios({ clients, hoje }) {
  const info = resumo(clients, [], hoje).niver
  const resto = info.mes.filter((c) => !info.hoje.some((h) => h.id === c.id))

  return (
    <section>
      <header className="page-head">
        <div>
          <h2>Aniversariantes</h2>
          <p>Quem tem data de nascimento neste mês. A mensagem só abre no WhatsApp, não envia sozinha.</p>
        </div>
      </header>
      <BlocoNiver titulo="Hoje" lista={info.hoje} hoje={hoje} vazio="Nenhum aniversariante hoje." />
      <BlocoNiver titulo="Neste mês" lista={resto} hoje={hoje} vazio="Nenhum outro aniversário neste mês." />
    </section>
  )
}

function BlocoNiver({ titulo, lista, hoje, vazio }) {
  return (
    <section className="card bloco">
      <h3>{titulo}</h3>
      {lista.length === 0 ? <p className="muted">{vazio}</p> : (
        <ul className="lista plain">
          {lista.map((c) => (
            <li key={c.id}>
              <a className="lista-main" href={`#/clientes/${c.id}`}>
                <Pessoa cliente={c} />
                <span>
                  <strong>{c.nome}</strong>
                  <small>Dia {md(c.nascimento).d} · {formatPhone(c.telefone)}</small>
                </span>
              </a>
              <Zap telefone={c.telefone} opcoes={[{ titulo: 'Aniversário', texto: msgNiver(c.nome) }]} direto />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Contatos({ clients, services, hoje }) {
  const grupos = gruposContato(clients, services, hoje)
  const blocos = [
    {
      titulo: 'Depois do serviço',
      texto: 'Atendimento nos últimos 7 dias.',
      itens: grupos.pos.map((item) => ({
        id: item.cliente.id,
        cliente: item.cliente,
        detalhe: `${item.servico.tipo} em ${dataCurta(item.servico.data)}`,
        mensagem: msgPos(item.cliente.nome),
      })),
    },
    {
      titulo: 'Garantia perto de vencer',
      texto: 'Vence nos próximos 15 dias.',
      itens: grupos.garantia.map((item) => ({
        id: item.cliente.id + item.servico.id,
        cliente: item.cliente,
        detalhe: `${item.servico.tipo} · ${textoPrazo(item.dias)}`,
        mensagem: msgGarantia(item.cliente.nome, item.servico.garantiaAte),
      })),
    },
    {
      titulo: 'Há tempo sem voltar',
      texto: 'Último contato ou serviço há mais de 12 meses.',
      itens: grupos.sumidos.map((item) => ({
        id: item.cliente.id,
        cliente: item.cliente,
        detalhe: `Desde ${dataCurta(item.desde)}`,
        mensagem: msgRetorno(item.cliente.nome),
      })),
    },
  ]

  return (
    <section>
      <header className="page-head">
        <div>
          <h2>Contatos</h2>
          <p>O botão abre a conversa com a mensagem pronta. O envio continua manual.</p>
        </div>
      </header>
      {blocos.map((bloco) => (
        <section key={bloco.titulo} className="card bloco">
          <h3>{bloco.titulo}</h3>
          <p className="muted">{bloco.texto}</p>
          {bloco.itens.length === 0 ? <p className="muted">Ninguém nesta lista.</p> : (
            <ul className="lista plain">
              {bloco.itens.map((item) => (
                <li key={item.id}>
                  <a className="lista-main" href={`#/clientes/${item.cliente.id}`}>
                    <Pessoa cliente={item.cliente} />
                    <span>
                      <strong>{item.cliente.nome}</strong>
                      <small>{item.detalhe}</small>
                    </span>
                  </a>
                  <Zap telefone={item.cliente.telefone} opcoes={[{ titulo: 'Falar', texto: item.mensagem }]} direto />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </section>
  )
}

function Ajustes({ dados, recarregar, avisar }) {
  const [f, setF] = useState({
    nome: dados.credor?.nome || 'Studio Seiko',
    documento: dados.credor?.documento || '',
    telefone: formatPhone(dados.credor?.telefone || ''),
    endereco: dados.credor?.endereco || '',
    cidade: dados.credor?.cidade || 'Cururupu-MA',
  })
  const [ocupado, setOcupado] = useState(false)
  const [hub, setHub] = useState(() => lerHub())
  const [rede, setRede] = useState(null)

  useEffect(() => {
    api('/api/rede').then(setRede).catch(() => setRede(null))
  }, [])

  useEffect(() => {
    setF({
      nome: dados.credor?.nome || 'Studio Seiko',
      documento: dados.credor?.documento || '',
      telefone: formatPhone(dados.credor?.telefone || ''),
      endereco: dados.credor?.endereco || '',
      cidade: dados.credor?.cidade || 'Cururupu-MA',
    })
  }, [dados.credor, dados.ultimoBackup])

  function set(chave, valor) {
    setF((atual) => ({ ...atual, [chave]: valor }))
  }

  async function salvarCredor(evento) {
    evento.preventDefault()
    setOcupado(true)
    try {
      await api('/api/credor', { method: 'PUT', body: f })
      await recarregar()
      avisar('Dados do credor salvos')
    } catch (err) {
      avisar(err.message)
    } finally {
      setOcupado(false)
    }
  }

  function baixarBlob(blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'backup-studio-seiko.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function baixarBackup() {
    try {
      const res = await fetch('/api/backup.json', { credentials: 'same-origin' })
      if (res.ok) {
        baixarBlob(await res.blob())
        await recarregar()
        avisar('Backup baixado')
        return
      }
    } catch {
      /* segue com a cópia deste aparelho */
    }
    const dados = await api('/api/data')
    baixarBlob(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }))
    avisar('Backup deste aparelho baixado')
  }

  async function salvarHubLocal(evento) {
    evento.preventDefault()
    salvarHub(hub.url, hub.token)
    try {
      await sincronizarAgora()
      await recarregar()
      avisar('Sincronização atualizada')
    } catch (err) {
      avisar(err.message)
    }
  }

  async function restaurar(evento) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    try {
      const texto = await arquivo.text()
      const json = JSON.parse(texto)
      if (!window.confirm('Restaurar este backup? Os dados atuais serão substituídos.')) return
      const resp = await api('/api/backup/restaurar', { method: 'POST', body: json })
      await recarregar()
      avisar(resp.origem === 'promissoria' ? 'Backup da Promissória Digital importado' : 'Backup restaurado')
    } catch {
      avisar('Arquivo de backup inválido')
    }
  }

  async function limpar() {
    if (!window.confirm('Apagar clientes, serviços e promissórias? Esta ação não volta atrás.')) return
    if (!window.confirm('Confirma limpar todos os cadastros?')) return
    await api('/api/reset', { method: 'POST' })
    await recarregar()
    avisar('Cadastros apagados')
  }

  const quando = dados.ultimoBackup
    ? new Date(dados.ultimoBackup).toLocaleString('pt-BR')
    : 'Nenhum realizado nesta sessão'

  return (
    <section>
      <header className="page-head">
        <div>
          <h2>Ajustes & backup</h2>
          <p>Dados do credor na nota e cópia de segurança do sistema.</p>
        </div>
      </header>
      <div className="ajustes-grid">
        <form className="card" onSubmit={salvarCredor}>
          <header className="card-head"><h2>Dados do credor (emissor da promissória)</h2></header>
          <p className="muted">Essas informações preenchem automaticamente as notas promissórias.</p>
          <label className="campo">
            <span>Nome completo / razão social</span>
            <input value={f.nome} onChange={(e) => set('nome', e.target.value)} required maxLength={120} />
          </label>
          <div className="grid-2">
            <label className="campo">
              <span>CPF ou CNPJ</span>
              <input value={f.documento} onChange={(e) => set('documento', e.target.value)} maxLength={20} placeholder="000.000.000-00" />
            </label>
            <label className="campo">
              <span>Telefone de contato</span>
              <input value={f.telefone} onChange={(e) => set('telefone', formatPhone(e.target.value))} inputMode="tel" />
            </label>
            <label className="campo">
              <span>Endereço comercial</span>
              <input value={f.endereco} onChange={(e) => set('endereco', e.target.value)} maxLength={180} />
            </label>
            <label className="campo">
              <span>Cidade de emissão</span>
              <input value={f.cidade} onChange={(e) => set('cidade', e.target.value)} maxLength={80} />
            </label>
          </div>
          <div className="row-btns fim">
            <button type="submit" className="btn gold" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Salvar dados do credor'}</button>
          </div>
        </form>
        <article className="card">
          <header className="card-head"><h2>Celular e notebook</h2></header>
          <p className="muted">No balcão, abra um destes endereços no outro aparelho, na mesma rede, e entre com a senha. A partir daí ele funciona sem internet e sincroniza quando o computador estiver ligado.</p>
          {rede?.enderecos?.length ? (
            <ul className="lista plain">
              {rede.enderecos.map((url) => <li key={url}><strong>{url}</strong></li>)}
            </ul>
          ) : <p className="muted">Endereço da rede aparece quando este computador está com o CRM aberto.</p>}
          {rede?.token && <p><span className="muted">Código de sincronização</span><br /><strong>{rede.token}</strong></p>}
          <form onSubmit={salvarHubLocal}>
            <label className="campo">
              <span>Endereço do computador (no link do GitHub)</span>
              <input value={hub.url} onChange={(e) => setHub((atual) => ({ ...atual, url: e.target.value }))} placeholder="http://192.168.0.10:5173" inputMode="url" />
            </label>
            <label className="campo">
              <span>Código de sincronização</span>
              <input value={hub.token} onChange={(e) => setHub((atual) => ({ ...atual, token: e.target.value }))} autoComplete="off" />
            </label>
            <button type="submit" className="btn ghost">Salvar e sincronizar</button>
          </form>
        </article>
        <article className="card">
          <header className="card-head"><h2>Backup, segurança e exportação</h2></header>
          <p><span className="muted">Último backup manual</span><br /><strong>{quando}</strong></p>
          <p className="dica">Sem internet dá para lançar pagamento neste aparelho. Quando o computador da loja responder, a alteração sobe sozinha.</p>
          <div className="acoes">
            <button type="button" onClick={baixarBackup}>Baixar backup (JSON)</button>
            <label className="arquivo-btn">
              Restaurar backup (JSON)
              <input type="file" accept="application/json,.json" onChange={restaurar} hidden />
            </label>
            <a href="/api/export/clientes.csv">Exportar clientes (CSV)</a>
            <a href="/api/export/servicos.csv">Exportar serviços (CSV)</a>
          </div>
          <button type="button" className="btn danger largo" style={{ marginTop: 16 }} onClick={limpar}>Limpar todos os dados</button>
        </article>
      </div>
    </section>
  )
}
