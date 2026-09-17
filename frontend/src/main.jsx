import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import './index.css'

const API = import.meta.env.VITE_API_URL || '/api'

async function api(path, options = {}) {
  const token = localStorage.getItem('dukafine_token')
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed')
    err.code = data.code
    err.email = data.email
    err.data = data
    throw err
  }
  return data
}

function Icon({ name, size = 18 }) {
  const paths = {
    bag: <><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/><path d="M9 12h.01M15 12h.01"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    user: <><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-6"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
    share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
    check: <path d="m5 12 4 4L19 6"/>
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.bag}</svg>
}

function Layout({ children, cartCount }) {
  const [user, setUser] = useState(null)
  useEffect(() => {
    if (localStorage.getItem('dukafine_token')) api('/auth/me').then(x => setUser(x.user)).catch(() => localStorage.removeItem('dukafine_token'))
  }, [])
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-emerald-950/10">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-800 text-white grid place-items-center"><Icon name="bag"/></div>
            <div><div className="font-black tracking-tight text-xl">DukaFine</div><div className="text-[10px] text-emerald-800 uppercase tracking-[.18em]">Kenyan commerce</div></div>
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/seller" className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-emerald-800">Seller</Link>
            {user?.role === 'admin' && <Link to="/admin" className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-emerald-800">Admin</Link>}
            <Link to="/cart" className="relative w-10 h-10 rounded-xl border border-slate-200 grid place-items-center bg-white"><Icon name="bag"/>{cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-emerald-800 text-white text-[10px] grid place-items-center">{cartCount}</span>}</Link>
            <Link to={user ? "/account" : "/login"} className="w-10 h-10 rounded-xl border border-slate-200 grid place-items-center bg-white"><Icon name="user"/></Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-slate-200 mt-16 bg-white">
        <div className="max-w-7xl mx-auto px-5 py-8 flex flex-col sm:flex-row justify-between gap-3 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} DukaFine</span><span>Built for Kenyan merchants and shoppers.</span>
        </div>
      </footer>
    </div>
  )
}

function Home({ addToCart }) {
  const [products, setProducts] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => { api(`/products?search=${encodeURIComponent(q)}`).then(x => setProducts(x.products)).catch(console.error) }, [q])
  return <Layout cartCount={0}>
    <section className="max-w-7xl mx-auto px-5 pt-10">
      <div className="rounded-[28px] bg-emerald-950 text-white p-7 md:p-12 overflow-hidden relative">
        <div className="max-w-2xl relative z-10">
          <div className="text-emerald-300 text-xs font-bold uppercase tracking-[.22em] mb-3">DukaFine marketplace</div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[.98]">Discover Kenyan stores. Shop with confidence.</h1>
          <p className="mt-5 text-emerald-100 max-w-xl">A simple storefront experience for local businesses, with secure M-Pesa checkout and order receipts.</p>
          <div className="mt-7 flex bg-white rounded-2xl p-1.5 max-w-xl">
            <div className="text-slate-400 grid place-items-center px-3"><Icon name="search"/></div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products..." className="flex-1 outline-none text-slate-800 px-2 py-3"/>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-72 h-72 rounded-full bg-emerald-700/30 blur-3xl"/>
      </div>
    </section>
    <section className="max-w-7xl mx-auto px-5 py-10">
      <div className="flex justify-between items-end mb-5"><div><div className="text-xs uppercase tracking-[.2em] text-emerald-800 font-bold">Marketplace</div><h2 className="text-2xl font-black mt-1">Featured products</h2></div></div>
      {products.length === 0 ? <div className="glass rounded-3xl p-12 text-center text-slate-500">No products found.</div> :
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map(p => <ProductCard key={p._id} product={p} addToCart={addToCart}/>)}
      </div>}
    </section>
  </Layout>
}

function ProductCard({ product, addToCart }) {
  return <article className="product-card bg-white rounded-3xl border border-slate-200 overflow-hidden">
    <Link to={`/product/${product._id}`}><img src={product.image_url || 'https://placehold.co/900x700/e8f1ec/17633f?text=DukaFine'} className="w-full aspect-[4/3] object-cover"/></Link>
    <div className="p-5">
      <Link to={`/product/${product._id}`} className="font-bold text-lg hover:text-emerald-800">{product.name}</Link>
      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{product.description}</p>
      <div className="flex items-center justify-between mt-5"><span className="font-black text-xl">KSh {product.price.toLocaleString()}</span><button onClick={() => addToCart(product)} className="bg-emerald-800 text-white rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2"><Icon name="plus" size={16}/>Cart</button></div>
      <div className="text-[11px] text-slate-400 mt-3">{product.quantity} in stock</div>
    </div>
  </article>
}

function ProductPage({ addToCart }) {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  useEffect(() => { api(`/products/${id}`).then(x => setProduct(x.product)).catch(console.error) }, [id])
  if (!product) return <Layout cartCount={0}><div className="max-w-7xl mx-auto p-10">Loading...</div></Layout>
  return <Layout cartCount={0}><div className="max-w-6xl mx-auto px-5 py-10 grid md:grid-cols-2 gap-10">
    <img src={product.image_url || 'https://placehold.co/900x700'} className="w-full aspect-square object-cover rounded-[28px]"/>
    <div className="py-5"><div className="text-xs text-emerald-800 font-bold uppercase tracking-[.2em]">{product.store?.vendor_name}</div><h1 className="text-4xl font-black mt-3">{product.name}</h1><div className="text-3xl font-black mt-5">KSh {product.price.toLocaleString()}</div><p className="text-slate-600 mt-5 leading-7">{product.description}</p><div className="mt-5 text-sm text-slate-500">{product.quantity} available</div><button disabled={!product.quantity} onClick={() => addToCart(product)} className="mt-7 w-full sm:w-auto bg-emerald-800 disabled:bg-slate-300 text-white px-7 py-3.5 rounded-xl font-bold">Add to cart</button></div>
  </div></Layout>
}

function Cart({ cart, setCart }) {
  const navigate = useNavigate()
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)
  const update = (id, qty) => setCart(cart.map(x => x._id === id ? {...x, quantity: Math.max(1, qty)} : x))
  return <Layout cartCount={cart.reduce((s,x)=>s+x.quantity,0)}><div className="max-w-5xl mx-auto px-5 py-10"><h1 className="text-3xl font-black">Your cart</h1>{!cart.length ? <div className="glass rounded-3xl p-10 mt-6 text-center"><p>Your cart is empty.</p><Link to="/" className="inline-block mt-5 bg-emerald-800 text-white rounded-xl px-5 py-3 font-bold">Continue shopping</Link></div> : <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-5"><div className="space-y-3">{cart.map(x => <div key={x._id} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 items-center"><img src={x.image_url || 'https://placehold.co/120'} className="w-20 h-20 rounded-xl object-cover"/><div className="flex-1"><div className="font-bold">{x.name}</div><div className="text-sm text-slate-500">KSh {x.price.toLocaleString()}</div><div className="flex items-center gap-2 mt-3"><button onClick={()=>update(x._id,x.quantity-1)} className="w-8 h-8 border rounded-lg">−</button><span>{x.quantity}</span><button onClick={()=>update(x._id,x.quantity+1)} className="w-8 h-8 border rounded-lg">+</button></div></div><button onClick={()=>setCart(cart.filter(y=>y._id!==x._id))} className="text-sm text-red-600">Remove</button></div>)}</div><aside className="bg-white border border-slate-200 rounded-2xl p-5 h-fit"><div className="text-sm text-slate-500">Total</div><div className="text-3xl font-black mt-1">KSh {total.toLocaleString()}</div><button onClick={()=>navigate('/checkout')} className="w-full mt-5 bg-emerald-800 text-white py-3.5 rounded-xl font-bold">Checkout</button></aside></div>}</div></Layout>
}

function OtpModal({ email, notice, autoResend, onClose, onVerified }) {
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [info, setInfo] = useState(notice || '')
  const [closing, setClosing] = useState(false)
  const inputsRef = useRef([])

  useEffect(() => {
    inputsRef.current[0]?.focus()
    if (autoResend) resend(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const close = () => { setClosing(true); setTimeout(onClose, 170) }

  const submit = async code => {
    setError(''); setLoading(true)
    try {
      const data = await api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp: code }) })
      setSuccess(true)
      setTimeout(() => onVerified(data), 900)
    } catch (e) {
      setError(e.message)
      setShake(true)
      setDigits(Array(6).fill(''))
      setTimeout(() => { setShake(false); inputsRef.current[0]?.focus() }, 450)
    } finally {
      setLoading(false)
    }
  }

  const setDigit = (i, val) => {
    if (!/^[0-9]?$/.test(val)) return
    const next = [...digits]; next[i] = val; setDigits(next)
    if (val && i < 5) inputsRef.current[i + 1]?.focus()
    if (next.every(d => d)) submit(next.join(''))
  }

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus()
  }

  const onPaste = e => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    e.preventDefault()
    const next = Array(6).fill('')
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setDigits(next)
    inputsRef.current[Math.min(text.length, 5)]?.focus()
    if (text.length === 6) submit(text)
  }

  const resend = async silent => {
    setResendLoading(true); if (!silent) setError('')
    try {
      const data = await api('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) })
      setInfo(data.message || 'A new code has been sent.')
      setCooldown(60)
    } catch (e) {
      if (e.data?.retry_after) setCooldown(e.data.retry_after)
      if (!silent) setError(e.message)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="otp-overlay fixed inset-0 z-50 bg-emerald-950/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`otp-card${closing ? ' leaving' : ''} bg-white w-full max-w-sm rounded-3xl p-7 relative shadow-2xl`}>
        <button onClick={close} className="absolute top-4 right-4 w-8 h-8 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <Icon name="x" size={16}/>
        </button>

        {!success ? <>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 grid place-items-center mx-auto">
            <span className="otp-envelope inline-block"><Icon name="shield" size={26}/></span>
          </div>
          <h2 className="text-xl font-black text-center mt-4">Verify your email</h2>
          <p className="text-sm text-slate-500 text-center mt-1.5">We sent a 6-digit code to<br/><span className="font-semibold text-slate-700">{email}</span></p>
          {info && <div className="mt-4 text-xs text-center text-emerald-800 bg-emerald-50 rounded-xl py-2 px-3">{info}</div>}

          <div className={`flex justify-center gap-2 mt-6 ${shake ? 'otp-shake' : ''}`}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => (inputsRef.current[i] = el)}
                value={d}
                onChange={e => setDigit(i, e.target.value.slice(-1))}
                onKeyDown={e => onKeyDown(i, e)}
                onPaste={onPaste}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                disabled={loading}
                className={`w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-black rounded-xl border-2 outline-none transition-colors ${error ? 'border-red-300 bg-red-50' : 'border-slate-200 focus:border-emerald-600'}`}
              />
            ))}
          </div>

          {error && <div className="text-sm text-red-600 text-center mt-3 font-semibold">{error}</div>}

          <button
            onClick={() => submit(digits.join(''))}
            disabled={loading || digits.some(d => !d)}
            className="w-full mt-6 bg-emerald-800 disabled:bg-slate-300 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            {loading ? <><span className="otp-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full"/>Verifying...</> : 'Verify email'}
          </button>

          <div className="text-center mt-5 text-sm text-slate-500">
            {cooldown > 0
              ? <span>Resend code in <span className="font-semibold text-slate-700">{cooldown}s</span></span>
              : <button onClick={() => resend(false)} disabled={resendLoading} className="text-emerald-800 font-bold hover:underline">{resendLoading ? 'Sending...' : "Didn't get it? Resend code"}</button>}
          </div>
        </> : (
          <div className="py-6 text-center">
            <div className="otp-check otp-ring w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center mx-auto"><Icon name="check" size={30}/></div>
            <h2 className="text-xl font-black mt-5">Email verified!</h2>
            <p className="text-sm text-slate-500 mt-1.5">Signing you in...</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Auth({ mode }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({name:'',email:'',phone_number:'',password:''})
  const [error,setError]=useState('')
  const [otpEmail,setOtpEmail]=useState(null)
  const [otpNotice,setOtpNotice]=useState('')
  const [otpAutoResend,setOtpAutoResend]=useState(false)

  const submit = async e => {
    e.preventDefault(); setError('')
    try {
      if (mode === 'login') {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(form) })
        localStorage.setItem('dukafine_token', data.token)
        navigate('/')
      } else {
        const data = await api('/auth/register', { method: 'POST', body: JSON.stringify(form) })
        setOtpAutoResend(false)
        setOtpNotice(data.message || 'Enter the verification code sent to your email.')
        setOtpEmail(data.email || form.email)
      }
    } catch (e) {
      if (e.code === 'email_not_verified') {
        setOtpAutoResend(true)
        setOtpNotice("Your email isn't verified yet — we're sending you a fresh code.")
        setOtpEmail(e.email || form.email)
      } else {
        setError(e.message)
      }
    }
  }

  return <Layout cartCount={0}>
    <div className="max-w-md mx-auto px-5 py-12">
      <div className="bg-white border border-slate-200 rounded-3xl p-7">
        <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white grid place-items-center"><Icon name="user"/></div>
        <h1 className="text-2xl font-black mt-5">{mode==='login'?'Welcome back':'Create your account'}</h1>
        <p className="text-sm text-slate-500 mt-1">{mode==='login'?'Your session stays active across page reloads.':'We\'ll send a 6-digit code to confirm your email.'}</p>
        <form onSubmit={submit} className="space-y-4 mt-7">
          {mode==='register'&&<input required placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full border rounded-xl p-3"/>}
          <input required type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full border rounded-xl p-3"/>
          {mode==='register'&&<input required placeholder="Safaricom phone e.g. 0712345678" value={form.phone_number} onChange={e=>setForm({...form,phone_number:e.target.value})} className="w-full border rounded-xl p-3"/>}
          <input required minLength="8" type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="w-full border rounded-xl p-3"/>
          {error&&<div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>}
          <button className="w-full bg-emerald-800 text-white rounded-xl py-3 font-bold">{mode==='login'?'Sign in':'Create account'}</button>
        </form>
        <div className="text-sm mt-5 text-center">{mode==='login'?<Link to="/register" className="text-emerald-800 font-bold">Create an account</Link>:<Link to="/login" className="text-emerald-800 font-bold">Already have an account?</Link>}</div>
      </div>
    </div>
    {otpEmail && (
      <OtpModal
        email={otpEmail}
        notice={otpNotice}
        autoResend={otpAutoResend}
        onClose={() => setOtpEmail(null)}
        onVerified={data => { localStorage.setItem('dukafine_token', data.token); navigate('/') }}
      />
    )}
  </Layout>
}

function Checkout({ cart, clearCart }) {
  const [address,setAddress]=useState('')
  const [phone,setPhone]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(false)
  const navigate=useNavigate()
  const submit=async e=>{e.preventDefault();setLoading(true);setMessage('');try{const verified=await api('/checkout/verify',{method:'POST',body:JSON.stringify({items:cart.map(x=>({product_id:x._id,quantity:x.quantity})),delivery_address:address})});setMessage(`Stock verified: KSh ${verified.amount.toLocaleString()}. Initializing M-Pesa STK Push...`);const out=await api('/checkout',{method:'POST',body:JSON.stringify({items:cart.map(x=>({product_id:x._id,quantity:x.quantity})),delivery_address:address,phone_number:phone})});clearCart();navigate(`/order/${out.order._id}`)}catch(e){setMessage(e.data?.detail?`${e.message}: ${e.data.detail}`:e.message)}finally{setLoading(false)}}
  if(!cart.length) return <Layout cartCount={0}><div className="max-w-xl mx-auto p-10">Your cart is empty.</div></Layout>
  return <Layout cartCount={cart.reduce((s,x)=>s+x.quantity,0)}><div className="max-w-2xl mx-auto px-5 py-10"><div className="text-xs uppercase tracking-[.2em] text-emerald-800 font-bold">Secure checkout</div><h1 className="text-3xl font-black mt-2">Delivery & M-Pesa</h1><p className="text-sm text-slate-500 mt-2">Inventory is verified again immediately before payment.</p><form onSubmit={submit} className="bg-white border border-slate-200 rounded-3xl p-6 mt-7 space-y-4"><label className="block text-sm font-bold">Delivery address<textarea required value={address} onChange={e=>setAddress(e.target.value)} rows="4" className="mt-2 w-full border rounded-xl p-3" placeholder="Estate, building, town..."/></label><label className="block text-sm font-bold">Safaricom number<input required value={phone} onChange={e=>setPhone(e.target.value)} className="mt-2 w-full border rounded-xl p-3" placeholder="0712345678"/></label><div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 flex gap-3"><Icon name="shield"/><span>Your checkout initializes the configured Daraja Buy Goods STK Push after the stock pre-check.</span></div>{message&&<div className="p-3 rounded-xl bg-slate-100 text-sm">{message}</div>}<button disabled={loading} className="w-full bg-emerald-800 disabled:bg-slate-400 text-white py-3.5 rounded-xl font-bold">{loading?'Processing...':'Verify stock & pay with M-Pesa'}</button></form></div></Layout>
}

function Order({ clearCart }) {
  const {id}=useParams(); const [order,setOrder]=useState(null)
  useEffect(()=>{let timer;const load=()=>api(`/orders/${id}`).then(x=>{setOrder(x.order);if(['payment_pending'].includes(x.order.status))timer=setTimeout(load,4000)}).catch(console.error);load();return()=>clearTimeout(timer)},[id])
  return <Layout cartCount={0}><div className="max-w-xl mx-auto px-5 py-12">{!order?<div>Checking order...</div>:<div className="bg-white border border-slate-200 rounded-3xl p-7 text-center"><div className={`w-16 h-16 rounded-full mx-auto grid place-items-center ${order.status==='paid'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-700'}`}><Icon name={order.status==='paid'?'check':'bag'} size={28}/></div><h1 className="text-2xl font-black mt-5">{order.status==='paid'?'Payment received':'Payment pending'}</h1><p className="text-slate-500 mt-2">Order {order.order_number}</p><div className="text-3xl font-black mt-6">KSh {order.amount.toLocaleString()}</div>{order.mpesa_code&&<div className="mt-4 text-sm">M-Pesa receipt: <b>{order.mpesa_code}</b></div>}<p className="text-sm text-slate-500 mt-5">A receipt is sent by email after successful confirmation.</p><Link to="/" className="inline-block mt-6 bg-emerald-800 text-white rounded-xl px-5 py-3 font-bold">Back to marketplace</Link></div>}</div></Layout>
}

function Seller() {
  const [stores,setStores]=useState([]),[form,setForm]=useState({name:'',till_number:'',phone_number:'',email:''}),[product,setProduct]=useState({store_id:'',name:'',price:'',quantity:'',image_url:'',description:''}),[msg,setMsg]=useState('')
  useEffect(()=>{api('/stores').then(x=>setStores(x.stores)).catch(()=>{})},[])
  const createStore=async e=>{e.preventDefault();try{const x=await api('/stores',{method:'POST',body:JSON.stringify(form)});setStores([...stores,x.store]);setMsg('Store created.');}catch(e){setMsg(e.message)}}
  const createProduct=async e=>{e.preventDefault();try{await api('/products',{method:'POST',body:JSON.stringify({...product,price:Number(product.price),quantity:Number(product.quantity)})});setMsg('Product created.');}catch(e){setMsg(e.message)}}
  const share=async id=>{try{const x=await api(`/share/product/${id}`);await navigator.clipboard.writeText(x.whatsapp_url);setMsg('WhatsApp sharing link copied to clipboard. Paste it into your group.')}catch(e){setMsg(e.message)}}
  return <Layout cartCount={0}><div className="max-w-7xl mx-auto px-5 py-10"><div className="flex justify-between"><div><div className="text-xs uppercase tracking-[.2em] text-emerald-800 font-bold">Merchant console</div><h1 className="text-3xl font-black">Seller workspace</h1></div></div>{msg&&<div className="mt-5 p-3 rounded-xl bg-emerald-50 text-emerald-900 text-sm">{msg}</div>}<div className="grid lg:grid-cols-2 gap-5 mt-7"><form onSubmit={createStore} className="bg-white border rounded-3xl p-6"><h2 className="font-black text-xl">Create storefront</h2><div className="space-y-3 mt-5">{[['name','Store name'],['till_number','Buy Goods Till'],['phone_number','Seller phone'],['email','Seller email']].map(([k,l])=><input key={k} required placeholder={l} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="w-full border rounded-xl p-3"/>)}<button className="w-full bg-emerald-800 text-white rounded-xl py-3 font-bold">Create store</button></div></form><form onSubmit={createProduct} className="bg-white border rounded-3xl p-6"><h2 className="font-black text-xl">Add product</h2><div className="space-y-3 mt-5"><select required value={product.store_id} onChange={e=>setProduct({...product,store_id:e.target.value})} className="w-full border rounded-xl p-3"><option value="">Select store</option>{stores.map(s=><option key={s._id} value={s._id}>{s.vendor_name}</option>)}</select>{[['name','Product name'],['price','Price'],['quantity','Stock'],['image_url','Image URL']].map(([k,l])=><input key={k} required placeholder={l} value={product[k]} onChange={e=>setProduct({...product,[k]:e.target.value})} className="w-full border rounded-xl p-3"/>)}<textarea placeholder="Description" value={product.description} onChange={e=>setProduct({...product,description:e.target.value})} className="w-full border rounded-xl p-3"/><button className="w-full bg-emerald-800 text-white rounded-xl py-3 font-bold">Publish product</button></div></form></div><div className="mt-7 bg-white border rounded-3xl p-6"><h2 className="font-black text-xl">Stores</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">{stores.map(s=><div key={s._id} className="border rounded-2xl p-4"><div className="font-bold">{s.vendor_name}</div><div className="text-xs text-slate-500 mt-1">Buy Goods Till: {s.till_number}</div><div className="text-xs text-slate-500">Phone: {s.phone_number}</div></div>)}</div><p className="text-xs text-slate-400 mt-5">The Share to WhatsApp Group action is available through the product sharing endpoint and can be wired to each seller's product list.</p></div></div></Layout>
}

function Admin() {
  const [stats,setStats]=useState(null),[orders,setOrders]=useState([]),[logs,setLogs]=useState([])
  useEffect(()=>{Promise.all([api('/admin/stats'),api('/admin/orders'),api('/admin/logs')]).then(([a,b,c])=>{setStats(a);setOrders(b.orders);setLogs(c.logs)}).catch(console.error)},[])
  return <Layout cartCount={0}><div className="max-w-7xl mx-auto px-5 py-10"><div className="flex items-center gap-3"><div className="w-11 h-11 bg-slate-900 text-white rounded-xl grid place-items-center"><Icon name="shield"/></div><div><div className="text-xs uppercase tracking-[.2em] text-slate-500 font-bold">Administration</div><h1 className="text-3xl font-black">DukaFine Control Center</h1></div></div>{stats&&<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-7">{[['Users',stats.users],['Stores',stats.stores],['Products',stats.products],['Orders',stats.orders],['Paid',stats.paid_orders],['Revenue',`KSh ${stats.revenue.toLocaleString()}`]].map(([a,b])=><div key={a} className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">{a}</div><div className="text-xl font-black mt-2">{b}</div></div>)}</div>}<div className="grid lg:grid-cols-2 gap-5 mt-7"><div className="bg-white border rounded-3xl p-5 overflow-auto"><h2 className="font-black">Recent orders</h2><table className="w-full text-sm mt-4"><tbody>{orders.slice(0,15).map(o=><tr key={o._id} className="border-b"><td className="py-3">{o.order_number}</td><td>{o.status}</td><td className="text-right">KSh {o.amount?.toLocaleString()}</td></tr>)}</tbody></table></div><div className="bg-white border rounded-3xl p-5 max-h-[500px] overflow-auto"><h2 className="font-black">Audit logs</h2><div className="space-y-2 mt-4">{logs.map(l=><div key={l._id} className="border-b pb-2"><div className="text-sm font-semibold">{l.action}</div><div className="text-[11px] text-slate-500">{l.actor_email || 'system'} · {new Date(l.created_at).toLocaleString()}</div></div>)}</div></div></div></div></Layout>
}

function Account() {
  const [user,setUser]=useState(null)
  useEffect(()=>{api('/auth/me').then(x=>setUser(x.user)).catch(console.error)},[])
  return <Layout cartCount={0}><div className="max-w-2xl mx-auto px-5 py-12"><div className="bg-white border rounded-3xl p-7"><div className="text-xs uppercase tracking-[.2em] text-emerald-800 font-bold">Account</div><h1 className="text-3xl font-black mt-2">{user?.name || 'Account'}</h1><p className="text-slate-500 mt-2">{user?.email}</p><p className="text-slate-500">{user?.phone_number}</p><button onClick={()=>{localStorage.removeItem('dukafine_token');location.href='/'}} className="mt-6 border border-red-200 text-red-700 rounded-xl px-5 py-3 font-bold">Sign out</button></div></div></Layout>
}

function NotFound() {
  return <Layout cartCount={0}>
    <div className="max-w-xl mx-auto px-5 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 grid place-items-center mx-auto"><Icon name="x" size={28}/></div>
      <div className="text-xs uppercase tracking-[.2em] text-emerald-800 font-bold mt-6">404</div>
      <h1 className="text-3xl font-black mt-2">Page not found</h1>
      <p className="text-slate-500 mt-3">The page you're looking for doesn't exist, was moved, or the link is broken.</p>
      <Link to="/" className="inline-block mt-7 bg-emerald-800 text-white rounded-xl px-6 py-3 font-bold">Back to marketplace</Link>
    </div>
  </Layout>
}

function App() {
  const [cart,setCart]=useState(()=>JSON.parse(localStorage.getItem('dukafine_cart')||'[]'))
  useEffect(()=>localStorage.setItem('dukafine_cart',JSON.stringify(cart)),[cart])
  const addToCart=p=>setCart(c=>{const x=c.find(i=>i._id===p._id);return x?c.map(i=>i._id===p._id?{...i,quantity:i.quantity+1}:i):[...c,{...p,quantity:1}]})
  const clearCart=()=>setCart([])
  return <Routes>
    <Route path="/" element={<Home addToCart={addToCart}/>}/>
    <Route path="/product/:id" element={<ProductPage addToCart={addToCart}/>}/>
    <Route path="/cart" element={<Cart cart={cart} setCart={setCart}/>}/>
    <Route path="/checkout" element={<Checkout cart={cart} clearCart={clearCart}/>}/>
    <Route path="/order/:id" element={<Order clearCart={clearCart}/>}/>
    <Route path="/login" element={<Auth mode="login"/>}/>
    <Route path="/register" element={<Auth mode="register"/>}/>
    <Route path="/account" element={<Account/>}/>
    <Route path="/seller" element={<Seller/>}/>
    <Route path="/admin" element={<Admin/>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes>
}

createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>)
