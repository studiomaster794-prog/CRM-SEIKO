import { useEffect, useMemo, useState } from 'react'
import { aoMudarRede, api, setAoAvisar, setAoSair } from './api.js'
import { FormCliente, FormServico, EscolherCliente, FormPromissoria, FormPagamento, FormProduto } from './forms.jsx'
import { Icon } from './icons.jsx'
import { dataLonga, diaSemana, hojeISO, moeda, primeiroNome, resumo, resumoPromissorias, obterTodasNotificacoes } from './logic.js'
import { Pagina, DetalhePromissoria, FolhaNota } from './screens.jsx'

const logo = `${import.meta.env.BASE_URL}logo-studio-seiko.png`

const CHAVE_NOTIFS_LIDAS = 'seiko_notifs_lidas_v1'

function carregarLidas() {
  try {
    const s = localStorage.getItem(CHAVE_NOTIFS_LIDAS)
    return new Set(s ? JSON.parse(s) : [])
  } catch {
    return new Set()
  }
}

function salvarLidas(set) {
  try {
    localStorage.setItem(CHAVE_NOTIFS_LIDAS, JSON.stringify([...set]))
  } catch {}
}

const MENU = [
  ['dashboard', 'Painel', 'home', '#/'],
  ['clientes', 'Clientes', 'users', '#/clientes'],
  ['promissorias', 'Promissórias', 'note', '#/promissorias'],
  ['servicos', 'Serviços', 'wrench', '#/servicos'],
  ['garantias', 'Garantias', 'shield', '#/garantias'],
  ['aniversarios', 'Aniversariantes', 'cake', '#/aniversarios'],
  ['notificacoes', 'Notificações', 'bell', '#/notificacoes'],
  ['ajustes', 'Ajustes', 'gear', '#/ajustes'],
]

function lerRota(hash) {
  const partes = (hash || '#/').replace(/^#/, '').split('/').filter(Boolean)
  if (partes[0] === 'clientes' && partes[1]) return { name: 'ficha', id: decodeURIComponent(partes[1]) }
  if (partes[0] === 'contatos') return { name: 'notificacoes' }
  const conhecida = MENU.find((item) => item[0] === partes[0])
  if (conhecida) return { name: conhecida[0] }
  return { name: 'dashboard' }
}

function Modal({ titulo, onClose, className = '', children }) {
  return (
    <div className="backdrop">
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <header>
          <h2 id="modal-titulo">{titulo}</h2>
          <button type="button" className="fechar" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        {children}
      </div>
    </div>
  )
}

function Acesso({ configurar, onOk, offline }) {
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    if (configurar && senha !== confirma) {
      setErro('As senhas não conferem')
      return
    }
    setOcupado(true)
    setErro('')
    try {
      const resposta = await api(configurar ? '/api/setup' : '/api/login', {
        method: 'POST',
        body: configurar ? { nome, senha } : { senha },
      })
      onOk(resposta)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <main className="acesso">
      <form className="acesso-card" onSubmit={enviar}>
        <img src={logo} alt="Studio Seiko" />
        <h1>{configurar ? 'Primeiro acesso' : 'Entrar'}</h1>
        <p>{configurar ? 'Crie a senha desta loja.' : 'Digite sua senha para acessar o sistema.'}</p>
        {configurar && (
          <label className="campo">
            <span>Seu nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus maxLength={60} />
          </label>
        )}
        <label className="campo">
          <span>Senha</span>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoFocus={!configurar} minLength={4} />
        </label>
        {configurar && (
          <label className="campo">
            <span>Confirmar senha</span>
            <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} required minLength={4} />
          </label>
        )}
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" className="btn gold largo" disabled={ocupado}>
          {ocupado ? 'Aguarde...' : configurar ? 'Criar acesso' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}

export default function App() {
  const [sessao, setSessao] = useState(null)
  const [dados, setDados] = useState({ clients: [], services: [], promissorias: [] })
  const [rota, setRota] = useState(() => lerRota(window.location.hash))
  const [menu, setMenu] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [rede, setRede] = useState({ texto: 'Bem-vindo ao CRM Studio Seiko', pendente: false })
  const hoje = hojeISO()

  useEffect(() => {
    const aoMudar = () => {
      setRota(lerRota(window.location.hash))
      setMenu(false)
    }
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  useEffect(() => {
    let vivo = true
    setAoSair(() => {
      if (vivo) setSessao({ autenticado: false, precisaConfigurar: false })
    })
    setAoAvisar((msg) => {
      if (vivo) setToast(msg)
    })
    api('/api/me')
      .then(async (me) => {
        if (!vivo) return
        if (!me.autenticado) {
          setSessao(me)
          return
        }
        const lista = await api('/api/data')
        if (!vivo) return
        setDados(lista)
        setSessao(me)
      })
      .catch(() => {
        if (vivo) setSessao({ autenticado: false, precisaConfigurar: false })
      })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => aoMudarRede(setRede), [])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const [lidas, setLidas] = useState(carregarLidas)

  const notifs = useMemo(() => {
    return obterTodasNotificacoes(dados.clients || [], dados.services || [], dados.promissorias || [], hoje)
  }, [dados, hoje])

  const naoLidas = useMemo(() => {
    return notifs.todas.filter((n) => !lidas.has(n.id))
  }, [notifs, lidas])

  const totalPendencias = naoLidas.length

  function marcarTodasLidas() {
    const novo = new Set([...lidas, ...notifs.todas.map((n) => n.id)])
    setLidas(novo)
    salvarLidas(novo)
  }

  async function recarregar() {
    setDados(await api('/api/data'))
  }

  async function entrar() {
    const me = await api('/api/me')
    const lista = await api('/api/data')
    setDados(lista)
    setSessao(me)
  }

  async function sair() {
    await api('/api/logout', { method: 'POST' })
    setSessao({ autenticado: false, precisaConfigurar: false })
    setDados({ clients: [], services: [], promissorias: [] })
  }

  function abrirCliente(cliente) {
    setModal({ tipo: 'cliente', cliente: cliente || null })
  }

  function abrirServico(clienteId, servico) {
    if (!clienteId) {
      setModal({ tipo: 'escolher' })
      return
    }
    setModal({ tipo: 'servico', clienteId, servico: servico || null })
  }

  function abrirPromissoria(clienteId, promissoria) {
    setModal({ tipo: 'promissoria', clienteId: clienteId || null, promissoria: promissoria || null })
  }

  function verPromissoria(promissoria) {
    setModal({ tipo: 'detalhe-prom', promissoria })
  }

  function abrirPagamento(promissoria) {
    setModal({ tipo: 'pagamento', promissoria })
  }

  function imprimirPromissoria(promissoria) {
    setModal({ tipo: 'nota', promissoria })
  }

  async function excluirPromissoria(promissoria) {
    if (!window.confirm('Excluir esta promissória?')) return
    await api(`/api/promissorias/${promissoria.id}`, { method: 'DELETE' })
    await recarregar()
    setModal(null)
    setToast('Promissória excluída')
  }

  async function excluirPagamento(promissoria, pag) {
    if (!window.confirm(`Excluir o pagamento de ${moeda(pag.valor)}? Esse valor volta a dever.`)) return
    const salvo = await api(`/api/promissorias/${promissoria.id}/pagamentos/${pag.id}`, { method: 'DELETE' })
    await recarregar()
    setModal({ tipo: 'detalhe-prom', promissoria: salvo })
    setToast('Pagamento excluído')
  }

  function itensDaProm(promissoria) {
    if ((promissoria?.itens || []).length) return promissoria.itens.map((item) => ({ produto: item.produto, valor: Number(item.valor) || 0 }))
    if (promissoria?.produto) return [{ produto: promissoria.produto, valor: Number(promissoria.valor) || 0 }]
    return []
  }

  async function salvarItens(promissoria, itens) {
    const salvo = await api(`/api/promissorias/${promissoria.id}`, {
      method: 'PUT',
      body: {
        itens,
        produto: promissoria.produto,
        valor: promissoria.valor,
        entrada: promissoria.entrada || 0,
        dataVenda: promissoria.dataVenda,
        vencimento: promissoria.vencimento,
        observacoes: promissoria.observacoes || '',
      },
    })
    await recarregar()
    setModal({ tipo: 'detalhe-prom', promissoria: salvo })
    return salvo
  }

  async function excluirProduto(promissoria, idx) {
    const itens = itensDaProm(promissoria)
    const item = itens[idx]
    if (!item) return
    if (itens.length <= 1) {
      if (!window.confirm(`Trocar "${item.produto}" por outro produto?`)) return
      setModal({ tipo: 'produto', promissoria, substituirIndex: idx })
      return
    }
    if (!window.confirm(`Excluir o produto "${item.produto}"?`)) return
    await salvarItens(promissoria, itens.filter((_, i) => i !== idx))
    setToast('Produto excluído')
  }

  async function excluirEntrada(promissoria) {
    if (!window.confirm(`Excluir a entrada de ${moeda(promissoria.entrada)}? Esse valor volta a dever.`)) return
    const salvo = await api(`/api/promissorias/${promissoria.id}`, {
      method: 'PUT',
      body: {
        itens: promissoria.itens,
        produto: promissoria.produto,
        valor: promissoria.valor,
        entrada: 0,
        dataVenda: promissoria.dataVenda,
        vencimento: promissoria.vencimento,
        observacoes: promissoria.observacoes || '',
      },
    })
    await recarregar()
    setModal({ tipo: 'detalhe-prom', promissoria: salvo })
    setToast('Entrada excluída')
  }

  async function excluirCliente(cliente) {
    const n = dados.services.filter((s) => s.clienteId === cliente.id).length
    const notas = (dados.promissorias || []).filter((p) => p.clienteId === cliente.id).length
    const extra = [
      n ? `${n} serviço(s)` : '',
      notas ? `${notas} promissória(s)` : '',
    ].filter(Boolean).join(' e ')
    const aviso = extra ? ` Também saem ${extra}.` : ''
    if (!window.confirm(`Excluir ${cliente.nome}?${aviso}`)) return
    await api(`/api/clients/${cliente.id}`, { method: 'DELETE' })
    await recarregar()
    window.location.hash = '#/clientes'
    setToast('Cliente excluído')
  }

  async function excluirServico(servico) {
    if (!window.confirm('Excluir este serviço do histórico?')) return
    await api(`/api/services/${servico.id}`, { method: 'DELETE' })
    await recarregar()
    setToast('Serviço excluído')
  }

  if (!sessao) {
    return (
      <main className="acesso">
        <img src={logo} alt="" />
      </main>
    )
  }

  if (!sessao.autenticado) {
    return <Acesso configurar={sessao.precisaConfigurar} offline={sessao.offline} onOk={entrar} />
  }

  const funcionario = sessao.papel === 'funcionario'
  const itensMenu = funcionario ? MENU.filter((item) => item[0] !== 'dashboard' && item[0] !== 'ajustes') : MENU
  const rotaVista = funcionario && (rota.name === 'dashboard' || rota.name === 'ajustes') ? { name: 'clientes' } : rota
  const ativo = (id) => rotaVista.name === id || (id === 'clientes' && rotaVista.name === 'ficha')
  const ano = hoje.slice(0, 4)

  return (
    <div className="shell">
      {menu && <button type="button" className="cortina" aria-label="Fechar menu" onClick={() => setMenu(false)} />}
      <aside className={menu ? 'sidebar open' : 'sidebar'}>
        <a className="brand" href={funcionario ? '#/clientes' : '#/'}>
          <img src={logo} alt="Studio Seiko" />
        </a>
        <nav className="nav" aria-label="Principal">
          {itensMenu.map(([id, rotulo, icone, href]) => (
            <a key={id} href={href} className={ativo(id) ? 'active' : ''} aria-current={ativo(id) ? 'page' : undefined}>
              <Icon name={icone} /> {rotulo}
            </a>
          ))}
        </nav>
        <footer className="side-foot">
          <p className="cidade"><Icon name="pin" /> Cururupu-MA</p>
          <small>Studio Seiko © {ano}</small>
        </footer>
      </aside>
      <div className="main">
        <header className="topbar">
          <button type="button" className="menu-btn" onClick={() => setMenu(true)} aria-label="Abrir menu">
            <span /><span /><span />
          </button>
          <div className="user-profile-top">
            <span className="user-avatar-gold" aria-hidden="true">
              <Icon name="user" />
            </span>
            <div className="ola">
              <h1>Olá, {primeiroNome(sessao.nome)}!</h1>
              <p className={rede.pendente ? 'rede-local' : ''}>{rede.texto}</p>
            </div>
          </div>
          <div className="topbar-right">
            <div className="data-hoje">
              <Icon name="calendar" />
              <div>
                <strong>{dataLonga(hoje)}</strong>
                <span>{diaSemana(hoje)}</span>
              </div>
            </div>
            <a
              href="#/notificacoes"
              className="btn-icon-top"
              onClick={marcarTodasLidas}
              title={totalPendencias > 0 ? `${totalPendencias} nova(s) notificação(ões)` : 'Sem novas notificações'}
              aria-label="Notificações"
            >
              <Icon name="bell" />
              {totalPendencias > 0 && <span className="badge-notif">{totalPendencias > 9 ? '9+' : totalPendencias}</span>}
            </a>
            <button type="button" className="btn-icon-top btn-power" onClick={sair} title="Encerrar sessão" aria-label="Sair">
              <Icon name="power" />
            </button>
          </div>
        </header>
        <div className="conteudo">
          <Pagina
            route={rotaVista}
            dados={dados}
            hoje={hoje}
            abrirCliente={abrirCliente}
            abrirServico={abrirServico}
            excluirCliente={excluirCliente}
            excluirServico={excluirServico}
            abrirPromissoria={abrirPromissoria}
            abrirPagamento={abrirPagamento}
            verPromissoria={verPromissoria}
            imprimirPromissoria={imprimirPromissoria}
            excluirPromissoria={excluirPromissoria}
            recarregar={recarregar}
            avisar={setToast}
            lidas={lidas}
            onMarcarTodasLidas={marcarTodasLidas}
          />
        </div>
      </div>
      {modal?.tipo === 'cliente' && (
        <Modal
          titulo={modal.cliente ? 'Editar cliente' : 'Novo cliente'}
          onClose={() => {
            if (modal.depois === 'promissoria') setModal({ tipo: 'promissoria', clienteId: modal.cliente?.id || null })
            else setModal(null)
          }}
        >
          <FormCliente
            inicial={modal.cliente}
            onClose={() => {
              if (modal.depois === 'promissoria') setModal({ tipo: 'promissoria', clienteId: modal.cliente?.id || null })
              else setModal(null)
            }}
            onAbrir={(id) => {
              setModal(null)
              window.location.hash = `#/clientes/${id}`
            }}
            onSalvo={async (salvo, novo) => {
              await recarregar()
              setToast(novo ? 'Cliente cadastrado' : 'Cadastro atualizado')
              if (modal.depois === 'promissoria') {
                setModal({ tipo: 'promissoria', clienteId: salvo.id })
                return
              }
              setModal(null)
              if (novo) window.location.hash = `#/clientes/${salvo.id}`
            }}
          />
        </Modal>
      )}
      {modal?.tipo === 'servico' && (
        <Modal titulo={modal.servico ? 'Editar serviço' : 'Novo serviço'} onClose={() => setModal(null)}>
          <FormServico
            inicial={modal.servico}
            clienteId={modal.clienteId}
            onClose={() => setModal(null)}
            onSalvo={async () => {
              await recarregar()
              setModal(null)
              setToast('Serviço registrado')
              window.location.hash = `#/clientes/${modal.clienteId}`
            }}
          />
        </Modal>
      )}
      {modal?.tipo === 'escolher' && (
        <Modal titulo="Para qual cliente?" onClose={() => setModal(null)}>
          <EscolherCliente
            clients={dados.clients}
            onClose={() => setModal(null)}
            onEscolher={(id) => setModal({ tipo: 'servico', clienteId: id })}
            onCriar={() => setModal({ tipo: 'cliente', cliente: null })}
          />
        </Modal>
      )}
      {modal?.tipo === 'promissoria' && (
        <Modal titulo={modal.promissoria ? 'Editar promissória' : 'Nova promissória'} className="modal-promissoria" onClose={() => setModal(null)}>
          <FormPromissoria
            inicial={modal.promissoria}
            clienteId={modal.clienteId}
            clients={dados.clients}
            onEditarCliente={(c) => setModal({ tipo: 'cliente', cliente: c, depois: 'promissoria' })}
            onClose={() => setModal(null)}
            onSalvo={async (salvo) => {
              await recarregar()
              setModal(null)
              setToast('Promissória salva')
              window.location.hash = `#/clientes/${salvo.clienteId || modal.clienteId}`
            }}
          />
        </Modal>
      )}
      {modal?.tipo === 'detalhe-prom' && (
        <Modal titulo="Promissória" onClose={() => setModal(null)}>
          <DetalhePromissoria
            p={modal.promissoria}
            cliente={dados.clients.find((c) => c.id === modal.promissoria.clienteId)}
            hoje={hoje}
            onClose={() => setModal(null)}
            onPagar={() => setModal({ tipo: 'pagamento', promissoria: modal.promissoria })}
            onAdicionarProduto={() => setModal({ tipo: 'produto', promissoria: modal.promissoria })}
            onEditarProduto={(_, idx) => setModal({ tipo: 'produto', promissoria: modal.promissoria, substituirIndex: idx })}
            onImprimir={() => setModal({ tipo: 'nota', promissoria: modal.promissoria })}
            onEditar={() => setModal({ tipo: 'promissoria', clienteId: modal.promissoria.clienteId, promissoria: modal.promissoria })}
            onExcluir={() => excluirPromissoria(modal.promissoria)}
            onExcluirPagamento={(pag) => excluirPagamento(modal.promissoria, pag)}
            onExcluirEntrada={() => excluirEntrada(modal.promissoria)}
            onExcluirProduto={(_, idx) => excluirProduto(modal.promissoria, idx)}
            onClienteSalvo={recarregar}
          />
        </Modal>
      )}
      {modal?.tipo === 'produto' && (
        <Modal titulo={modal.substituirIndex != null ? 'Editar produto' : 'Adicionar produto'} onClose={() => setModal({ tipo: 'detalhe-prom', promissoria: modal.promissoria })}>
          <FormProduto
            promissoria={modal.promissoria}
            substituirIndex={modal.substituirIndex}
            onClose={() => setModal({ tipo: 'detalhe-prom', promissoria: modal.promissoria })}
            onSalvo={async (salvo) => {
              await recarregar()
              setModal({ tipo: 'detalhe-prom', promissoria: salvo })
              setToast(modal.substituirIndex != null ? 'Produto atualizado' : 'Produto adicionado')
            }}
          />
        </Modal>
      )}
      {modal?.tipo === 'pagamento' && (
        <Modal titulo="Registrar pagamento" onClose={() => setModal(null)}>
          <FormPagamento
            promissoria={modal.promissoria}
            hoje={hoje}
            onClose={() => setModal(null)}
            onSalvo={async (salvo) => {
              await recarregar()
              setModal({ tipo: 'detalhe-prom', promissoria: salvo })
              setToast('Valor adicionado')
            }}
          />
        </Modal>
      )}
      {modal?.tipo === 'nota' && (
        <Modal titulo="Nota promissória" onClose={() => setModal(null)}>
          <div className="nota-preview">
            <FolhaNota
              p={modal.promissoria}
              cliente={dados.clients.find((c) => c.id === modal.promissoria.clienteId)}
              credor={dados.credor}
              hoje={hoje}
            />
          </div>
          <div className="row-btns fim">
            <button type="button" className="btn ghost" onClick={() => setModal(null)}>Fechar</button>
            <button type="button" className="btn gold" onClick={() => window.print()}>Imprimir</button>
          </div>
        </Modal>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
