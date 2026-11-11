let aoSair = () => {}

export function setAoSair(fn) {
  aoSair = fn
}

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { erro: 'Resposta inválida do servidor' }
    }
  }
  if (res.status === 401 && path !== '/api/login' && path !== '/api/setup') aoSair()
  if (!res.ok) {
    const err = new Error(data?.erro || 'Não foi possível concluir')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
