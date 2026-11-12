import { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { MARCAS, TIPOS, addDays, dataCurta, formatCpf, formatPhone, hojeISO, isISODate, linhaEndereco, moeda, nomeProprio } from './logic.js'

function nomeNoCampo(evento, aplicar) {
  const el = evento.target
  const ini = el.selectionStart
  const fim = el.selectionEnd
  aplicar(nomeProprio(el.value))
  requestAnimationFrame(() => {
    if (document.activeElement === el) el.setSelectionRange(ini, fim)
  })
}

function Campo({ label, children }) {
  return (
    <label className="campo">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function FormCliente({ inicial, onSalvo, onClose, onAbrir }) {
  const [f, setF] = useState({
    nome: inicial?.nome || '',
    telefone: formatPhone(inicial?.telefone || ''),
    cpf: formatCpf(inicial?.cpf || ''),
    endereco: inicial?.endereco || '',
    numero: inicial?.numero || '',
    bairro: inicial?.bairro || '',
    referencia: inicial?.referencia || '',
    nascimento: inicial?.nascimento || '',
    cadastro: inicial?.cadastro || hojeISO(),
    observacoes: inicial?.observacoes || '',
  })
  const [erro, setErro] = useState('')
  const [dup, setDup] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  function set(chave, valor) {
    setDup(null)
    setF((atual) => ({ ...atual, [chave]: valor }))
  }

  async function enviar(evento, forcar) {
    evento?.preventDefault()
    setOcupado(true)
    setErro('')
    try {
      const salvo = await api(inicial ? `/api/clients/${inicial.id}` : '/api/clients', {
        method: inicial ? 'PUT' : 'POST',
        body: { ...f, forcar: !!forcar },
      })
      await onSalvo(salvo, !inicial)
    } catch (err) {
      if (err.status === 409) setDup(err.data?.cliente || null)
      else setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="form" onSubmit={(evento) => enviar(evento, false)}>
      <Campo label="Nome completo">
        <input value={f.nome} onChange={(e) => nomeNoCampo(e, (nome) => set('nome', nome))} required autoFocus maxLength={120} />
      </Campo>
      <div className="grid-2">
        <Campo label="Telefone / WhatsApp">
          <input value={f.telefone} onChange={(e) => set('telefone', formatPhone(e.target.value))} inputMode="tel" placeholder="Se tiver, com DDD" />
        </Campo>
        <Campo label="CPF">
          <input value={f.cpf} onChange={(e) => set('cpf', formatCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
        </Campo>
      </div>
      <div className="grid-2">
        <Campo label="Data de nascimento">
          <input type="date" value={f.nascimento} max={hojeISO()} onChange={(e) => set('nascimento', e.target.value)} />
        </Campo>
        <Campo label="Data do primeiro cadastro">
          <input type="date" value={f.cadastro} max={hojeISO()} onChange={(e) => set('cadastro', e.target.value)} required />
        </Campo>
      </div>
      <div className="grid-endereco">
        <Campo label="Endereço">
          <input value={f.endereco} onChange={(e) => set('endereco', e.target.value)} maxLength={180} placeholder="Rua" />
        </Campo>
        <Campo label="Número">
          <input value={f.numero} onChange={(e) => set('numero', e.target.value)} maxLength={20} placeholder="119" />
        </Campo>
      </div>
      <div className="grid-2">
        <Campo label="Bairro">
          <input value={f.bairro} onChange={(e) => set('bairro', e.target.value)} maxLength={80} placeholder="Areia Branca" />
        </Campo>
        <Campo label="Ponto de referência">
          <input value={f.referencia} onChange={(e) => set('referencia', e.target.value)} maxLength={120} placeholder="Próximo à padaria" />
        </Campo>
      </div>
      <Campo label="Observações gerais">
        <textarea rows={2} value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} maxLength={2000} />
      </Campo>
      {dup && (
        <div className="alerta">
          <p>Já existe um cadastro com este telefone: <strong>{dup.nome}</strong>.</p>
          <div className="row-btns">
            <button type="button" className="btn gold" onClick={() => onAbrir(dup.id)}>Abrir ficha</button>
            <button type="button" className="btn ghost" onClick={(evento) => enviar(evento, true)}>Cadastrar mesmo assim</button>
          </div>
        </div>
      )}
      {erro && <p className="erro">{erro}</p>}
      <div className="row-btns fim">
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn gold" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Salvar cliente'}</button>
      </div>
    </form>
  )
}

export function FormServico({ inicial, clienteId, onSalvo, onClose }) {
  const prazoInicial = inicial?.prazoDias || 0
  const preset = [30, 90, 180, 365].includes(prazoInicial)
  const [f, setF] = useState({
    data: inicial?.data || hojeISO(),
    tipo: inicial?.tipo || '',
    marca: inicial?.marca || '',
    modelo: inicial?.modelo || '',
    valor: inicial ? String(inicial.valor) : '',
    pecas: inicial?.pecas || '',
    diagnostico: inicial?.diagnostico || '',
    observacoes: inicial?.observacoes || '',
  })
  const [modo, setModo] = useState(!prazoInicial ? '' : preset ? String(prazoInicial) : 'outro')
  const [outro, setOutro] = useState(preset || !prazoInicial ? '' : String(prazoInicial))
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  function set(chave, valor) {
    setF((atual) => ({ ...atual, [chave]: valor }))
  }

  const prazo = modo === 'outro' ? Number(outro) : modo ? Number(modo) : 0
  const ate = prazo > 0 && isISODate(f.data) ? addDays(f.data, prazo) : ''

  async function enviar(evento) {
    evento.preventDefault()
    if (modo === 'outro' && (!Number.isInteger(prazo) || prazo < 1)) {
      setErro('Informe o prazo em dias')
      return
    }
    setOcupado(true)
    setErro('')
    try {
      const salvo = await api(inicial ? `/api/services/${inicial.id}` : '/api/services', {
        method: inicial ? 'PUT' : 'POST',
        body: {
          ...f,
          clienteId,
          valor: f.valor === '' ? '' : Number(String(f.valor).includes(',') ? String(f.valor).replace(/\./g, '').replace(',', '.') : f.valor),
          prazoDias: prazo || null,
        },
      })
      await onSalvo(salvo)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="grid-2">
        <Campo label="Data do serviço">
          <input type="date" value={f.data} max={hojeISO()} onChange={(e) => set('data', e.target.value)} required />
        </Campo>
        <Campo label="Tipo de serviço">
          <input value={f.tipo} onChange={(e) => set('tipo', e.target.value)} list="tipos-servico" required maxLength={80} placeholder="Troca de bateria" />
        </Campo>
        <Campo label="Marca">
          <input value={f.marca} onChange={(e) => set('marca', e.target.value)} list="marcas-relogio" maxLength={80} />
        </Campo>
        <Campo label="Modelo">
          <input value={f.modelo} onChange={(e) => set('modelo', e.target.value)} maxLength={80} />
        </Campo>
        <Campo label="Valor cobrado">
          <input value={f.valor} onChange={(e) => set('valor', e.target.value)} inputMode="decimal" required placeholder="0,00" />
        </Campo>
        <Campo label="Prazo de garantia">
          <select value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="">Sem garantia</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="180">6 meses</option>
            <option value="365">1 ano</option>
            <option value="outro">Outro prazo</option>
          </select>
        </Campo>
      </div>
      {modo === 'outro' && (
        <Campo label="Prazo em dias">
          <input value={outro} onChange={(e) => setOutro(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="45" />
        </Campo>
      )}
      {ate && <p className="dica">Garantia até {dataCurta(ate)}</p>}
      <Campo label="Peças utilizadas">
        <input value={f.pecas} onChange={(e) => set('pecas', e.target.value)} maxLength={500} />
      </Campo>
      <Campo label="Diagnóstico técnico">
        <textarea rows={3} value={f.diagnostico} onChange={(e) => set('diagnostico', e.target.value)} maxLength={2000} />
      </Campo>
      <Campo label="Observações importantes">
        <textarea rows={3} value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} maxLength={2000} placeholder="O que foi combinado com o cliente" />
      </Campo>
      <datalist id="tipos-servico">
        {TIPOS.map((tipo) => <option key={tipo} value={tipo} />)}
      </datalist>
      <datalist id="marcas-relogio">
        {MARCAS.map((marca) => <option key={marca} value={marca} />)}
      </datalist>
      {erro && <p className="erro">{erro}</p>}
      <div className="row-btns fim">
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn gold" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Salvar serviço'}</button>
      </div>
    </form>
  )
}

export function EscolherCliente({ clients, onEscolher, onClose, onCriar }) {
  const [texto, setTexto] = useState('')
  const termo = texto.trim().toLowerCase()
  const digitos = texto.replace(/\D/g, '')
  const buscar = termo.length >= 2 || digitos.length >= 3
  const lista = buscar
    ? clients
      .filter((c) => [c.nome, c.telefone, c.cpf, c.endereco, c.numero, c.bairro, c.referencia, c.observacoes].join(' ').toLowerCase().includes(termo) || (digitos.length >= 3 && String(c.telefone || '').includes(digitos)))
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 8)
    : []

  return (
    <div className="form">
      <Campo label="Cliente já cadastrado">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus placeholder="Nome ou telefone" />
      </Campo>
      {buscar && (
        <div className="escolha">
          {lista.map((c) => (
            <button type="button" key={c.id} onClick={() => onEscolher(c.id)}>
              <strong>{c.nome}</strong>
              <span>{formatPhone(c.telefone)}</span>
            </button>
          ))}
          {lista.length === 0 && <p className="muted">Nenhum cliente encontrado.</p>}
        </div>
      )}
      <div className="row-btns fim">
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn gold" onClick={onCriar}>Novo cliente</button>
      </div>
    </div>
  )
}

function parseMoeda(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'))
  return Number(s)
}

const pessoaVazia = {
  nome: '',
  telefone: '',
  cpf: '',
  endereco: '',
  numero: '',
  bairro: '',
  referencia: '',
  nascimento: '',
}

function pessoaDoCliente(c) {
  return {
    nome: c.nome || '',
    telefone: formatPhone(c.telefone || ''),
    cpf: formatCpf(c.cpf || ''),
    endereco: c.endereco || '',
    numero: c.numero || '',
    bairro: c.bairro || '',
    referencia: c.referencia || '',
    nascimento: c.nascimento || '',
  }
}

export function FormPromissoria({ inicial, clienteId, clients, onSalvo, onClose, onEditarCliente }) {
  const [f, setF] = useState({
    clienteId: inicial?.clienteId || clienteId || '',
    entrada: inicial ? String(inicial.entrada || 0) : '0',
    dataVenda: inicial?.dataVenda || hojeISO(),
    vencimento: inicial?.vencimento || addDays(hojeISO(), 30),
    observacoes: inicial?.observacoes || '',
  })
  const [itens, setItens] = useState(() => {
    if (inicial?.itens?.length) return inicial.itens.map((item) => ({ produto: item.produto, valor: item.valor }))
    if (inicial?.produto) return [{ produto: inicial.produto, valor: Number(inicial.valor) || 0 }]
    return []
  })
  const [produto, setProduto] = useState('')
  const [preco, setPreco] = useState('')
  const [pessoa, setPessoa] = useState(pessoaVazia)
  const [modoNovo, setModoNovo] = useState(!inicial && !clienteId)
  const [ligadoId, setLigadoId] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const cliente = (clients || []).find((c) => c.id === f.clienteId)
  const termo = pessoa.nome.trim().toLowerCase()
  const digTel = pessoa.telefone.replace(/\D/g, '')
  const sugestoes = useMemo(() => {
    if (!modoNovo || ligadoId || (termo.length < 2 && digTel.length < 3)) return []
    return (clients || [])
      .filter((c) => (termo.length >= 2 && (c.nome || '').toLowerCase().includes(termo)) || (digTel.length >= 3 && (c.telefone || '').includes(digTel)))
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 5)
  }, [clients, termo, digTel, modoNovo, ligadoId])

  function aplicarCliente(c) {
    setLigadoId(c.id)
    setPessoa(pessoaDoCliente(c))
    setF((atual) => ({ ...atual, clienteId: c.id }))
  }

  useEffect(() => {
    if (!modoNovo || ligadoId) return
    let achou = null
    if (digTel.length >= 10) {
      const tels = (clients || []).filter((c) => (c.telefone || '').length >= 10 && (c.telefone || '').includes(digTel))
      if (tels.length === 1) achou = tels[0]
    }
    if (!achou && sugestoes.length === 1) {
      const nomeCheio = (sugestoes[0].nome || '').trim().toLowerCase()
      if ((termo && nomeCheio === termo) || (termo.length >= 8 && nomeCheio.startsWith(termo))) achou = sugestoes[0]
    }
    if (achou) aplicarCliente(achou)
  }, [modoNovo, ligadoId, digTel, termo, sugestoes, clients])

  function set(chave, valor) {
    setF((atual) => ({ ...atual, [chave]: valor }))
  }

  function listaItens() {
    const extraNome = produto.trim()
    const extraValor = Number(parseMoeda(preco)) || 0
    if (extraNome.length >= 2 && extraValor > 0) return [...itens, { produto: extraNome, valor: extraValor }]
    return itens
  }

  function adicionarProduto() {
    const nome = produto.trim()
    const valor = Number(parseMoeda(preco)) || 0
    if (nome.length < 2) {
      setErro('Informe o produto')
      return
    }
    if (valor <= 0) {
      setErro('Informe o valor do produto')
      return
    }
    setItens((atual) => [...atual, { produto: nome, valor }])
    setProduto('')
    setPreco('')
    setErro('')
  }

  async function garantirCliente() {
    if (!modoNovo) {
      if (!f.clienteId) setErro('Escolha o cliente desta venda')
      return f.clienteId || null
    }
    if (pessoa.nome.trim().length < 3) {
      setErro('Informe o nome completo')
      return null
    }
    const atual = ligadoId ? (clients || []).find((c) => c.id === ligadoId) : null
    const body = {
      ...pessoa,
      cadastro: atual?.cadastro || hojeISO(),
      observacoes: atual?.observacoes || '',
    }
    try {
      const salvo = await api(atual ? `/api/clients/${atual.id}` : '/api/clients', {
        method: atual ? 'PUT' : 'POST',
        body,
      })
      return salvo.id
    } catch (err) {
      const id = err.status === 409 ? err.data?.cliente?.id : ''
      const cheio = id ? (clients || []).find((c) => c.id === id) : null
      if (cheio) {
        aplicarCliente(cheio)
        setErro(`Este telefone já é de ${cheio.nome}. Os dados foram preenchidos. Confira e registre de novo.`)
        return null
      }
      throw err
    }
  }

  async function enviar(evento) {
    evento.preventDefault()
    const lista = listaItens()
    if (!lista.length) {
      setErro('Adicione pelo menos um produto')
      return
    }
    setOcupado(true)
    setErro('')
    try {
      const idCliente = await garantirCliente()
      if (!idCliente) return
      const salvo = await api(inicial ? `/api/promissorias/${inicial.id}` : '/api/promissorias', {
        method: inicial ? 'PUT' : 'POST',
        body: {
          ...f,
          clienteId: idCliente,
          itens: lista,
          entrada: parseMoeda(f.entrada) || 0,
        },
      })
      await onSalvo(salvo)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const valorN = listaItens().reduce((acc, item) => acc + Number(item.valor || 0), 0)
  const entradaN = Number(parseMoeda(f.entrada)) || 0
  const devendo = Math.max(0, Math.round((valorN - entradaN) * 100) / 100)

  return (
    <form className="form" onSubmit={enviar}>
      {modoNovo && (
        <>
          <div className="grid-nome-nasc">
            <Campo label="Nome completo">
              <input value={pessoa.nome} onChange={(e) => nomeNoCampo(e, (nome) => { setErro(''); setPessoa((atual) => ({ ...atual, nome })) })} autoFocus required maxLength={120} placeholder="Nome do cliente" />
            </Campo>
            <Campo label="Data de nascimento">
              <input type="date" value={pessoa.nascimento} max={hojeISO()} onChange={(e) => setPessoa((atual) => ({ ...atual, nascimento: e.target.value }))} />
            </Campo>
          </div>
          {sugestoes.length > 0 && (
            <div className="escolha">
              {sugestoes.map((c) => (
                <button type="button" key={c.id} onClick={() => aplicarCliente(c)}>
                  <strong>{c.nome}</strong>
                  <span>{formatPhone(c.telefone)}{linhaEndereco(c) ? ` · ${linhaEndereco(c)}` : ''}</span>
                </button>
              ))}
            </div>
          )}
          {ligadoId && (
            <p className="ok">Cadastro encontrado. Confira os dados abaixo. <button type="button" className="link" onClick={() => { setLigadoId(''); setPessoa(pessoaVazia); set('clienteId', '') }}>Não é este cliente</button></p>
          )}
          <div className="grid-2">
            <Campo label="Telefone / WhatsApp">
              <input value={pessoa.telefone} onChange={(e) => { setErro(''); setPessoa((atual) => ({ ...atual, telefone: formatPhone(e.target.value) })) }} inputMode="tel" placeholder="Se tiver, com DDD" />
            </Campo>
            <Campo label="CPF">
              <input value={pessoa.cpf} onChange={(e) => setPessoa((atual) => ({ ...atual, cpf: formatCpf(e.target.value) }))} inputMode="numeric" placeholder="000.000.000-00" />
            </Campo>
          </div>
          <div className="grid-endereco-completo">
            <Campo label="Endereço">
              <input value={pessoa.endereco} onChange={(e) => setPessoa((atual) => ({ ...atual, endereco: e.target.value }))} maxLength={180} placeholder="Rua" />
            </Campo>
            <Campo label="Número">
              <input value={pessoa.numero} onChange={(e) => setPessoa((atual) => ({ ...atual, numero: e.target.value }))} maxLength={20} placeholder="119" />
            </Campo>
            <Campo label="Bairro">
              <input value={pessoa.bairro} onChange={(e) => setPessoa((atual) => ({ ...atual, bairro: e.target.value }))} maxLength={80} placeholder="Areia Branca" />
            </Campo>
          </div>
          <Campo label="Ponto de referência">
            <input value={pessoa.referencia} onChange={(e) => setPessoa((atual) => ({ ...atual, referencia: e.target.value }))} maxLength={120} placeholder="Próximo à padaria" />
          </Campo>
        </>
      )}
      {!modoNovo && cliente && (
        <article className="resumo-prom cliente-venda">
          <p className="largo ok"><span>Cliente</span>{cliente.nome}</p>
          <p><span>Telefone</span>{formatPhone(cliente.telefone) || '—'}</p>
          <p><span>CPF</span>{formatCpf(cliente.cpf) || '—'}</p>
          <p className="largo"><span>Endereço</span>{linhaEndereco(cliente) || '—'}</p>
        </article>
      )}
      {!modoNovo && cliente && !inicial && (
        <p className="ok">Dados de {cliente.nome} preenchidos. Só falta o produto desta venda.</p>
      )}
      {!modoNovo && cliente && (
        <div className="row-btns">
          {!inicial && (
            <button type="button" className="btn ghost" onClick={() => { setModoNovo(true); setLigadoId(''); setPessoa(pessoaVazia); set('clienteId', '') }}>Trocar cliente</button>
          )}
          {onEditarCliente && (
            <button type="button" className="btn ghost" onClick={() => onEditarCliente(cliente)}>Editar cliente</button>
          )}
        </div>
      )}
      <div className="add-produto">
        <Campo label="Produto desta venda">
          <input value={produto} onChange={(e) => setProduto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarProduto() } }} maxLength={180} placeholder="Relógio Orient masculino" autoFocus={!!cliente && !inicial} />
        </Campo>
        <Campo label="Valor">
          <input value={preco} onChange={(e) => setPreco(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarProduto() } }} inputMode="decimal" placeholder="0,00" />
        </Campo>
        <button type="button" className="btn gold" onClick={adicionarProduto}>Adicionar</button>
      </div>
      {itens.length > 0 && (
        <ul className="lista plain itens-venda">
          {itens.map((item, i) => (
            <li key={`${item.produto}-${i}`}>
              <span><strong>{item.produto}</strong></span>
              <span className="pag-valor">
                <strong>{moeda(item.valor)}</strong>
                <button type="button" className="btn-x" aria-label="Excluir produto" onClick={() => setItens((atual) => atual.filter((_, idx) => idx !== i))}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid-3">
        <Campo label="Entrada">
          <input value={f.entrada} onChange={(e) => set('entrada', e.target.value)} inputMode="decimal" placeholder="0,00" />
        </Campo>
        <Campo label="Data da venda">
          <input type="date" value={f.dataVenda} max={hojeISO()} onChange={(e) => set('dataVenda', e.target.value)} required />
        </Campo>
        <Campo label="Vencimento">
          <input type="date" value={f.vencimento} onChange={(e) => set('vencimento', e.target.value)} required />
        </Campo>
      </div>
      <div className="resumo-venda-compacto">
        <span>Venda: <b>{moeda(valorN)}</b></span>
        <span>Entrada: <b>{moeda(entradaN)}</b></span>
        <span>Devendo: <b className={devendo > 0.01 ? 'txt-devendo' : ''}>{moeda(devendo)}</b></span>
      </div>
      <Campo label="Observações">
        <textarea rows={1} value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} maxLength={2000} placeholder="Opcional" />
      </Campo>
      {erro && <p className="erro">{erro}</p>}
      <div className="row-btns fim">
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn gold" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Registrar venda'}</button>
      </div>
    </form>
  )
}

export function FormPagamento({ promissoria, hoje, onSalvo, onClose }) {
  const [f, setF] = useState({ valor: '', data: hoje, forma: 'Dinheiro', obs: '' })
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    setOcupado(true)
    setErro('')
    try {
      const salvo = await api(`/api/promissorias/${promissoria.id}/pagamentos`, {
        method: 'POST',
        body: { ...f, valor: parseMoeda(f.valor) },
      })
      await onSalvo(salvo)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="grid-2">
        <Campo label="Valor pago agora">
          <input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} inputMode="decimal" placeholder="50,00" required />
        </Campo>
        <Campo label="Data">
          <input type="date" value={f.data} max={hoje} onChange={(e) => setF({ ...f, data: e.target.value })} required />
        </Campo>
      </div>
      <Campo label="Forma">
        <select value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}>
          <option>Dinheiro</option>
          <option>Pix</option>
          <option>Cartão</option>
          <option>Transferência</option>
        </select>
      </Campo>
      <Campo label="Observação">
        <input value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} maxLength={400} />
      </Campo>
      {erro && <p className="erro">{erro}</p>}
      <div className="row-btns fim">
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn gold" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Registrar pagamento'}</button>
      </div>
    </form>
  )
}

function itensDaProm(p) {
  if ((p?.itens || []).length) return p.itens.map((item) => ({ produto: item.produto, valor: Number(item.valor) || 0 }))
  if (p?.produto) return [{ produto: p.produto, valor: Number(p.valor) || 0 }]
  return []
}

export function FormProduto({ promissoria, substituirIndex, onSalvo, onClose }) {
  const atual = itensDaProm(promissoria)[substituirIndex]
  const [produto, setProduto] = useState(atual?.produto || '')
  const [preco, setPreco] = useState(atual ? String(atual.valor).replace('.', ',') : '')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    const nome = produto.trim()
    const valor = Number(parseMoeda(preco)) || 0
    if (nome.length < 2) {
      setErro('Informe o produto')
      return
    }
    if (valor <= 0) {
      setErro('Informe o valor do produto')
      return
    }
    setOcupado(true)
    setErro('')
    try {
      const itens = itensDaProm(promissoria)
      const item = { produto: nome, valor }
      const lista = substituirIndex != null
        ? itens.map((linha, i) => (i === substituirIndex ? item : linha))
        : [...itens, item]
      const salvo = await api(`/api/promissorias/${promissoria.id}`, {
        method: 'PUT',
        body: {
          itens: lista,
          produto: promissoria.produto,
          valor: promissoria.valor,
          entrada: promissoria.entrada || 0,
          dataVenda: promissoria.dataVenda,
          vencimento: promissoria.vencimento,
          observacoes: promissoria.observacoes || '',
        },
      })
      await onSalvo(salvo)
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="form" onSubmit={enviar}>
      {atual ? <p className="dica">Arrume o nome ou o valor e salve.</p> : <p className="dica">Pode acrescentar outro produto nesta mesma venda.</p>}
      <Campo label="Produto">
        <input value={produto} onChange={(e) => setProduto(e.target.value)} maxLength={180} placeholder="Relógio Orient masculino" autoFocus required />
      </Campo>
      <Campo label="Valor">
        <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="0,00" required />
      </Campo>
      {erro && <p className="erro">{erro}</p>}
      <div className="row-btns fim">
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn gold" disabled={ocupado}>{ocupado ? 'Salvando...' : atual ? 'Salvar produto' : 'Adicionar produto'}</button>
      </div>
    </form>
  )
}
