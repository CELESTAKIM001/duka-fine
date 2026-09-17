import React, { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import './index.css'

const API = import.meta.env.VITE_API_URL || '/api'

async function api(path, options = {}) {
  const token = localStorage.getItem('dukafine_token')
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || data.message || 'Request failed')
    err.code = data.code
    err.email = data.email
    err.data = data
    throw err
  }
  return data
}

const money = n => `KSh ${Number(n || 0).toLocaleString('en-KE')}`
const placeholder = 'https://placehold.co/900x700/e8f4ee/14532d?text=DukaFine'

function Icon({ name, size = 19 }) {
  const paths = {
    bag: <><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    user: <><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <path d="M5 12h14"/>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    back: <><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-6"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    heart: <path d="M20.8 8.7c0 5.5-8.8 10.3-8.8 10.3S3.2 14.2 3.2 8.7A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.4Z"/>,
    store: <><path d="M4 10h16"/><path d="M5 10v10h14V10"/><path d="M3 10 5 4h14l2 6"/><path d="M9 20v-6h6v6"/></>,
    truck: <><path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    phone: <><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.7-4L3 10"/><path d="M3 5v5h5"/><path d="M4 13a8 8 0 0 0 14.7 4L21 14"/><path d="M21 19v-5h-5"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></>
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.bag}</svg>
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'btn-primary',
    soft: 'btn-soft',
    outline: 'btn-outline',
    danger: 'btn-danger',
    ghost: 'btn-ghost'
  }
  return <button className={`btn ${variants[variant]} ${className}`} {...props}>{children}</button>
}

function Layout({ children, cartCount = 0 }) {
  const [user, setUser] = useState(null)
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!localStorage.getItem('dukafine_token')) { setUser(null); return }
    api('/auth/me').then(x => setUser(x.user)).catch(() => {
      localStorage.removeItem('dukafine_token')
      setUser(null)
    })
  }, [location.pathname])

  const submitSearch = e => {
    e.preventDefault()
    navigate(search.trim() ? `/?q=${encodeURIComponent(search.trim())}` : '/')
    setMenu(false)
  }

  const logout = () => {
    localStorage.removeItem('dukafine_token')
    setUser(null)
    navigate('/')
  }

  return <div className="app-shell">
    <div className="topbar">Free delivery promotions are set by individual stores · Secure checkout with M-Pesa</div>
    <header className="site-header">
      <div className="header-inner">
        <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Menu"><Icon name={menu ? 'x' : 'menu'}/></button>
        <Link to="/" className="brand" onClick={() => setMenu(false)}>
          <span className="brand-mark"><Icon name="bag" size={22}/></span>
          <span><strong>DukaFine</strong><small>Kenyan marketplace</small></span>
        </Link>
        <form className="header-search" onSubmit={submitSearch}>
          <Icon name="search" size={18}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products, stores..." aria-label="Search"/>
          {search && <button type="button" className="search-clear" onClick={() => setSearch('')}><Icon name="x" size={15}/></button>}
        </form>
        <nav className="desktop-nav">
          <Link to="/seller">Sell</Link>
          {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
          <Link to={user ? '/account' : '/login'} className="nav-icon"><Icon name="user"/><span>{user ? 'Account' : 'Sign in'}</span></Link>
          <Link to="/cart" className="nav-cart"><Icon name="bag"/><span>Cart</span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
        </nav>
        <div className="mobile-actions">
          <Link to="/cart" className="icon-button"><Icon name="bag"/>{cartCount > 0 && <b>{cartCount}</b>}</Link>
        </div>
      </div>
      <div className={`mobile-nav ${menu ? 'open' : ''}`}>
        <form onSubmit={submitSearch} className="mobile-search"><Icon name="search"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search DukaFine..."/></form>
        <Link to="/seller" onClick={() => setMenu(false)}>Merchant workspace</Link>
        {user?.role === 'admin' && <Link to="/admin" onClick={() => setMenu(false)}>Admin control center</Link>}
        <Link to={user ? '/account' : '/login'} onClick={() => setMenu(false)}>{user ? 'My account' : 'Sign in / Register'}</Link>
      </div>
    </header>
    <main>{children}</main>
    <footer className="footer">
      <div className="footer-grid">
        <div><Link to="/" className="brand footer-brand"><span className="brand-mark"><Icon name="bag"/></span><span><strong>DukaFine</strong><small>Kenyan marketplace</small></span></Link><p>Simple online storefronts for Kenyan businesses, with M-Pesa checkout built into the buying journey.</p></div>
        <div><h4>Shop</h4><Link to="/">Marketplace</Link><Link to="/cart">Cart</Link><Link to="/login">Sign in</Link></div>
        <div><h4>Business</h4><Link to="/seller">Sell on DukaFine</Link><Link to="/admin">Admin</Link></div>
        <div><h4>Support</h4><span>Secure M-Pesa checkout</span><span>Email verification</span><span>Order receipts</span></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} DukaFine</span><span>Made for local commerce in Kenya</span></div>
    </footer>
  </div>
}

function Hero() {
  return <section className="hero">
    <div className="hero-copy">
      <span className="eyebrow light">DukaFine marketplace</span>
      <h1>Shop local.<br/><em>Grow local.</em></h1>
      <p>Discover products from Kenyan businesses and check out with a familiar, secure M-Pesa experience.</p>
      <div className="hero-actions"><Link className="btn btn-white" to="#products">Explore products <Icon name="arrow" size={17}/></Link><Link className="hero-link" to="/seller">I run a business <Icon name="arrow" size={15}/></Link></div>
    </div>
    <div className="hero-art">
      <div className="hero-card hero-card-main"><span>Featured today</span><strong>Local finds</strong><small>Curated products from independent sellers</small><div className="hero-mini-row"><div></div><div></div><div></div><b>+120</b></div></div>
      <div className="hero-badge"><span>✓</span><div><strong>M-Pesa ready</strong><small>Simple checkout</small></div></div>
    </div>
  </section>
}

function ProductCard({ product, addToCart }) {
  const [added, setAdded] = useState(false)
  const add = () => {
    addToCart(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }
  return <article className="product-card">
    <Link to={`/product/${product._id}`} className="product-image-wrap">
      <img src={product.image_url || placeholder} alt={product.name} className="product-image"/>
      {Number(product.quantity) <= 0 ? <span className="stock-pill out">Out of stock</span> : Number(product.quantity) <= 5 ? <span className="stock-pill">Only {product.quantity} left</span> : null}
    </Link>
    <div className="product-body">
      <div className="product-store">{product.store?.vendor_name || 'DukaFine seller'}</div>
      <Link to={`/product/${product._id}`} className="product-name">{product.name}</Link>
      <p>{product.description || 'Quality product from a local Kenyan seller.'}</p>
      <div className="product-bottom"><strong>{money(product.price)}</strong><Button onClick={add} disabled={!product.quantity}>{added ? <><Icon name="check" size={16}/> Added</> : <><Icon name="plus" size={16}/> Add</>}</Button></div>
    </div>
  </article>
}

function Home({ addToCart }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const initialQ = params.get('q') || ''
  const [products, setProducts] = useState([])
  const [stores, setStores] = useState([])
  const [q, setQ] = useState(initialQ)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('featured')
  const [stockOnly, setStockOnly] = useState(false)

  useEffect(() => setQ(initialQ), [initialQ])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const timer = setTimeout(() => {
      api(`/products?search=${encodeURIComponent(q)}`)
        .then(x => { if (alive) setProducts(x.products || []) })
        .catch(e => { if (alive) setError(e.message) })
        .finally(() => { if (alive) setLoading(false) })
    }, 220)
    return () => { alive = false; clearTimeout(timer) }
  }, [q])

  useEffect(() => { api('/stores').then(x => setStores(x.stores || [])).catch(() => {}) }, [])

  const visible = useMemo(() => {
    let list = stockOnly ? products.filter(p => Number(p.quantity) > 0) : [...products]
    if (sort === 'price-low') list.sort((a,b) => a.price-b.price)
    if (sort === 'price-high') list.sort((a,b) => b.price-a.price)
    if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name))
    return list
  }, [products, sort, stockOnly])

  return <Layout cartCount={0}>
    <div className="container page-space">
      <Hero/>
      <section className="trust-row">
        <div><span className="trust-icon"><Icon name="shield"/></span><div><strong>Secure checkout</strong><small>Protected account flow</small></div></div>
        <div><span className="trust-icon"><Icon name="phone"/></span><div><strong>M-Pesa ready</strong><small>Built for Kenyan payments</small></div></div>
        <div><span className="trust-icon"><Icon name="truck"/></span><div><strong>Local sellers</strong><small>Discover businesses near you</small></div></div>
        <div><span className="trust-icon"><Icon name="mail"/></span><div><strong>Order receipts</strong><small>Confirmation by email</small></div></div>
      </section>

      <section id="products" className="section">
        <div className="section-heading">
          <div><span className="eyebrow">Marketplace</span><h2>{q ? `Results for “${q}”` : 'Fresh from local sellers'}</h2><p>Browse products published by DukaFine merchants.</p></div>
          <div className="filters">
            <label className="check-control"><input type="checkbox" checked={stockOnly} onChange={e => setStockOnly(e.target.checked)}/><span>In stock</span></label>
            <select value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {loading ? <div className="product-grid">{Array.from({length:6}).map((_,i)=><div className="skeleton-card" key={i}><div className="skeleton image"></div><div className="skeleton line long"></div><div className="skeleton line"></div><div className="skeleton line short"></div></div>)}</div>
          : visible.length ? <div className="product-grid">{visible.map(p => <ProductCard key={p._id} product={p} addToCart={addToCart}/>)}</div>
          : <EmptyState title="No products found" text="Try a different search or clear your filters." action={<Button onClick={() => {setQ(''); setStockOnly(false)}}>Clear filters</Button>}/>}
      </section>

      <section className="section store-strip">
        <div className="section-heading compact"><div><span className="eyebrow">Local businesses</span><h2>Stores on DukaFine</h2></div><Link className="text-link" to="/seller">Start selling <Icon name="arrow" size={15}/></Link></div>
        <div className="store-grid">{stores.slice(0,6).map(s => <div className="store-card" key={s._id}><div className="store-avatar"><Icon name="store"/></div><div><strong>{s.vendor_name}</strong><small>Buy Goods Till: {s.till_number || 'Configured by seller'}</small></div></div>)}{!stores.length && <div className="empty-inline">Seller storefronts will appear here as merchants publish them.</div>}</div>
      </section>
    </div>
  </Layout>
}

function EmptyState({ title, text, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="bag" size={28}/></div><h3>{title}</h3><p>{text}</p>{action && <div className="empty-action">{action}</div>}</div>
}

function ProductPage({ addToCart }) {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  useEffect(() => { setLoading(true); api(`/products/${id}`).then(x => setProduct(x.product)).catch(() => setProduct(null)).finally(() => setLoading(false)) }, [id])
  if (loading) return <Layout><div className="container page-space"><div className="detail-skeleton"></div></div></Layout>
  if (!product) return <Layout><div className="container page-space"><EmptyState title="Product not found" text="This product may have been removed or the link is no longer valid." action={<Link className="btn btn-primary" to="/">Back to marketplace</Link>}/></div></Layout>
  const add = () => { for(let i=0;i<qty;i++) addToCart(product); setAdded(true); setTimeout(()=>setAdded(false),1200) }
  return <Layout>
    <div className="container page-space">
      <Link to="/" className="back-link"><Icon name="back" size={16}/> Back to marketplace</Link>
      <div className="product-detail">
        <div className="detail-media"><img src={product.image_url || placeholder} alt={product.name}/></div>
        <div className="detail-info">
          <span className="eyebrow">{product.store?.vendor_name || 'DukaFine seller'}</span>
          <h1>{product.name}</h1>
          <div className="detail-price">{money(product.price)}</div>
          <p className="detail-description">{product.description || 'A product offered by a local DukaFine merchant.'}</p>
          <div className="availability"><span className={product.quantity ? 'dot green' : 'dot red'}></span>{product.quantity ? `${product.quantity} available` : 'Currently unavailable'}</div>
          {product.quantity > 0 && <div className="quantity-row"><span>Quantity</span><div className="quantity-control"><button onClick={()=>setQty(Math.max(1,qty-1))}><Icon name="minus"/></button><strong>{qty}</strong><button onClick={()=>setQty(Math.min(product.quantity,qty+1))}><Icon name="plus"/></button></div></div>}
          <Button className="wide-action" disabled={!product.quantity} onClick={add}>{added ? <><Icon name="check"/> Added to cart</> : <><Icon name="bag"/> Add to cart</>}</Button>
          <div className="detail-benefits"><div><Icon name="shield"/><span><strong>Secure</strong><small>Protected checkout</small></span></div><div><Icon name="phone"/><span><strong>M-Pesa</strong><small>Kenyan payment flow</small></span></div></div>
        </div>
      </div>
    </div>
  </Layout>
}

function Cart({ cart, setCart }) {
  const navigate = useNavigate()
  const subtotal = cart.reduce((s,x) => s + x.price*x.quantity, 0)
  const count = cart.reduce((s,x) => s+x.quantity, 0)
  const update = (id, qty) => setCart(cart.map(x => x._id === id ? {...x, quantity: Math.max(1, Math.min(Number(x.quantity || 1) + 99, qty))} : x))
  return <Layout cartCount={count}><div className="container narrow page-space">
    <div className="page-heading"><span className="eyebrow">Shopping cart</span><h1>Your cart</h1><p>{count ? `${count} item${count===1?'':'s'} ready for checkout.` : 'Your cart is waiting for its first item.'}</p></div>
    {!cart.length ? <EmptyState title="Your cart is empty" text="Explore local products and add something you like." action={<Link className="btn btn-primary" to="/">Continue shopping</Link>}/> :
      <div className="cart-layout"><div className="cart-list">{cart.map(x => <div className="cart-item" key={x._id}><img src={x.image_url || placeholder} alt={x.name}/><div className="cart-item-main"><span className="product-store">{x.store?.vendor_name || 'DukaFine seller'}</span><Link to={`/product/${x._id}`} className="cart-name">{x.name}</Link><strong>{money(x.price)}</strong><div className="quantity-control"><button onClick={()=>{if(x.quantity>1) update(x._id,x.quantity-1)}}><Icon name="minus" size={15}/></button><b>{x.quantity}</b><button onClick={()=>update(x._id,x.quantity+1)}><Icon name="plus" size={15}/></button></div></div><button className="remove-link" onClick={()=>setCart(cart.filter(y=>y._id!==x._id))}>Remove</button></div>)}</div>
      <aside className="summary-card"><span className="eyebrow">Order summary</span><div className="summary-line"><span>Items</span><b>{count}</b></div><div className="summary-line"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="summary-line muted"><span>Delivery</span><span>Calculated by seller</span></div><div className="summary-total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><Button className="wide-action" onClick={()=>navigate('/checkout')}>Continue to checkout <Icon name="arrow"/></Button><Link to="/" className="continue-link">Continue shopping</Link></aside></div>}
  </div></Layout>
}

function OtpModal({ email, notice, autoResend, onClose, onVerified }) {
  const [code,setCode] = useState('')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [cooldown,setCooldown] = useState(autoResend ? 60 : 0)
  useEffect(()=>{ if(!autoResend) return; api('/auth/resend-otp',{method:'POST',body:JSON.stringify({email})}).catch(()=>{}); },[autoResend,email])
  useEffect(()=>{ if(cooldown<=0)return; const t=setInterval(()=>setCooldown(v=>Math.max(0,v-1)),1000);return()=>clearInterval(t)},[cooldown])
  const verify=async e=>{e.preventDefault();setError('');if(code.length!==6){setError('Enter the 6-digit verification code.');return}setBusy(true);try{const x=await api('/auth/verify-otp',{method:'POST',body:JSON.stringify({email,otp:code})});onVerified(x)}catch(e){setError(e.message)}finally{setBusy(false)}}
  const resend=async()=>{if(cooldown)return;setError('');try{await api('/auth/resend-otp',{method:'POST',body:JSON.stringify({email})});setCooldown(60)}catch(e){setError(e.message)}}
  return <div className="modal-backdrop"><div className="otp-card"><button className="modal-close" onClick={onClose}><Icon name="x"/></button><div className="otp-icon"><Icon name="mail" size={28}/></div><span className="eyebrow">Verify your email</span><h2>Enter your code</h2><p>{notice || `We sent a 6-digit code to ${email}.`}</p><form onSubmit={verify}><input autoFocus inputMode="numeric" maxLength="6" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className="otp-input" placeholder="000000"/>{error&&<div className="alert error">{error}</div>}<Button className="wide-action" disabled={busy}>{busy?'Verifying...':'Verify email'}</Button></form><button className="resend" disabled={cooldown>0} onClick={resend}>{cooldown ? `Resend code in ${cooldown}s` : 'Resend verification code'}</button></div></div>
}

function Auth({ mode }) {
  const navigate = useNavigate()
  const [form,setForm] = useState({name:'',email:'',phone_number:'',password:''})
  const [error,setError]=useState('')
  const [otpEmail,setOtpEmail]=useState(null)
  const [otpNotice,setOtpNotice]=useState('')
  const [otpAutoResend,setOtpAutoResend]=useState(false)
  const submit=async e=>{e.preventDefault();setError('');try{if(mode==='login'){const data=await api('/auth/login',{method:'POST',body:JSON.stringify(form)});localStorage.setItem('dukafine_token',data.token);navigate('/')}else{const data=await api('/auth/register',{method:'POST',body:JSON.stringify(form)});setOtpAutoResend(false);setOtpNotice(data.message || 'Enter the verification code sent to your email.');setOtpEmail(data.email || form.email)}}catch(e){if(e.code==='email_not_verified'){setOtpAutoResend(true);setOtpNotice("Your email isn't verified yet — we're sending you a fresh code.");setOtpEmail(e.email || form.email)}else setError(e.message)}}
  return <Layout><div className="auth-page container"><div className="auth-panel"><div className="auth-side"><span className="brand-mark large"><Icon name="bag" size={28}/></span><span className="eyebrow light">DukaFine</span><h1>{mode==='login'?'Welcome back.':'Build your account.'}</h1><p>{mode==='login'?'Continue shopping from your saved session.':'Join a growing marketplace for Kenyan businesses and shoppers.'}</p><div className="auth-perks"><span><Icon name="shield"/> Secure account flow</span><span><Icon name="phone"/> M-Pesa-ready checkout</span><span><Icon name="mail"/> Verified email</span></div></div><div className="auth-form"><span className="eyebrow">{mode==='login'?'Account access':'New account'}</span><h2>{mode==='login'?'Sign in':'Create your account'}</h2><p className="form-intro">{mode==='login'?'Use your email and password to continue.':'We will send a 6-digit code to verify your email.'}</p><form onSubmit={submit} className="form-stack">{mode==='register'&&<Field label="Full name"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your full name"/></Field>}<Field label="Email"><input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></Field>{mode==='register'&&<Field label="Safaricom phone"><input required value={form.phone_number} onChange={e=>setForm({...form,phone_number:e.target.value})} placeholder="0712 345 678"/></Field>}<Field label="Password"><input required minLength="8" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></Field>{error&&<div className="alert error">{error}</div>}<Button className="wide-action">{mode==='login'?'Sign in':'Create account'} <Icon name="arrow"/></Button></form><div className="auth-switch">{mode==='login'?'New to DukaFine?':'Already have an account?'} <Link to={mode==='login'?'/register':'/login'}>{mode==='login'?'Create an account':'Sign in'}</Link></div></div></div></div>{otpEmail&&<OtpModal email={otpEmail} notice={otpNotice} autoResend={otpAutoResend} onClose={()=>setOtpEmail(null)} onVerified={data=>{localStorage.setItem('dukafine_token',data.token);navigate('/')}}/>}</Layout>
}

function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label> }

function Checkout({ cart, clearCart }) {
  const [address,setAddress]=useState('')
  const [phone,setPhone]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(false)
  const navigate=useNavigate()
  const total=cart.reduce((s,x)=>s+x.price*x.quantity,0)
  const submit=async e=>{e.preventDefault();setLoading(true);setMessage('');try{const items=cart.map(x=>({product_id:x._id,quantity:x.quantity}));const verified=await api('/checkout/verify',{method:'POST',body:JSON.stringify({items,delivery_address:address})});setMessage(`Stock verified for ${money(verified.amount)}. Initializing M-Pesa...`);const out=await api('/checkout',{method:'POST',body:JSON.stringify({items,delivery_address:address,phone_number:phone})});clearCart();navigate(`/order/${out.order._id}`)}catch(e){setMessage(e.data?.detail?`${e.message}: ${e.data.detail}`:e.message)}finally{setLoading(false)}}
  if(!cart.length)return <Layout><div className="container narrow page-space"><EmptyState title="Nothing to check out" text="Add products to your cart first." action={<Link className="btn btn-primary" to="/">Browse products</Link>}/></div></Layout>
  return <Layout cartCount={cart.reduce((s,x)=>s+x.quantity,0)}><div className="container narrow page-space"><Link to="/cart" className="back-link"><Icon name="back" size={16}/> Back to cart</Link><div className="page-heading checkout-heading"><span className="eyebrow">Secure checkout</span><h1>Delivery & M-Pesa</h1><p>Inventory is checked again immediately before payment is requested.</p></div><div className="checkout-layout"><form onSubmit={submit} className="checkout-form"><Field label="Delivery address"><textarea required rows="4" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Estate, building, town, delivery notes..."/></Field><Field label="Safaricom number"><input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0712 345 678"/></Field><div className="security-note"><Icon name="shield"/><div><strong>Your payment is protected</strong><span>The configured Daraja STK Push will be requested after stock verification.</span></div></div>{message&&<div className="alert info">{message}</div>}<Button className="wide-action" disabled={loading}>{loading?'Processing checkout...':<>Verify stock & pay <Icon name="arrow"/></>}</Button></form><aside className="summary-card"><span className="eyebrow">Summary</span>{cart.map(x=><div className="mini-item" key={x._id}><span>{x.name} × {x.quantity}</span><b>{money(x.price*x.quantity)}</b></div>)}<div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div></aside></div></div></Layout>
}

function Order({ clearCart }) {
  const {id}=useParams(); const [order,setOrder]=useState(null); const [error,setError]=useState('')
  useEffect(()=>{let timer;let alive=true;const load=()=>api(`/orders/${id}`).then(x=>{if(!alive)return;setOrder(x.order);if(x.order.status==='payment_pending')timer=setTimeout(load,4000)}).catch(e=>setError(e.message));load();return()=>{alive=false;clearTimeout(timer)}},[id])
  if(error)return <Layout><div className="container narrow page-space"><EmptyState title="Order unavailable" text={error} action={<Link className="btn btn-primary" to="/">Back to marketplace</Link>}/></div></Layout>
  if(!order)return <Layout><div className="container narrow page-space"><div className="loading-panel"><div className="spinner"></div><h2>Checking your order</h2><p>Waiting for the latest payment status...</p></div></div></Layout>
  const paid=order.status==='paid'
  return <Layout><div className="container narrow page-space"><div className="order-result"><div className={`result-icon ${paid?'success':'pending'}`}><Icon name={paid?'check':'refresh'} size={32}/></div><span className="eyebrow">{paid?'Payment confirmed':'Payment pending'}</span><h1>{paid?'Thank you for your order.':'Your payment is being confirmed.'}</h1><p>Order <strong>{order.order_number}</strong></p><div className="order-amount">{money(order.amount)}</div>{order.mpesa_code&&<div className="receipt-code">M-Pesa receipt <strong>{order.mpesa_code}</strong></div>}<div className="order-note">{paid?'A receipt has been sent by email.':'Keep this page open while we wait for the M-Pesa callback.'}</div><div className="result-actions"><Link className="btn btn-primary" to="/">Continue shopping</Link><Link className="btn btn-outline" to="/account">My account</Link></div></div></div></Layout>
}

function Seller() {
  const [stores,setStores]=useState([])
  const [form,setForm]=useState({name:'',till_number:'',phone_number:'',email:''})
  const [product,setProduct]=useState({store_id:'',name:'',price:'',quantity:'',image_url:'',description:''})
  const [msg,setMsg]=useState('')
  const [tab,setTab]=useState('overview')
  useEffect(()=>{api('/stores').then(x=>setStores(x.stores||[])).catch(e=>setMsg(e.message))},[])
  const createStore=async e=>{e.preventDefault();try{const x=await api('/stores',{method:'POST',body:JSON.stringify(form)});setStores(s=>[...s,x.store]);setMsg('Storefront created successfully.');setForm({name:'',till_number:'',phone_number:'',email:''})}catch(e){setMsg(e.message)}}
  const createProduct=async e=>{e.preventDefault();try{await api('/products',{method:'POST',body:JSON.stringify({...product,price:Number(product.price),quantity:Number(product.quantity)}));setMsg('Product published successfully.');setProduct({store_id:'',name:'',price:'',quantity:'',image_url:'',description:''})}catch(e){setMsg(e.message)}}
  return <Layout><div className="container page-space"><div className="dashboard-header"><div><span className="eyebrow">Merchant console</span><h1>Seller workspace</h1><p>Set up your storefront and publish products for shoppers.</p></div><div className="dashboard-icon"><Icon name="store" size={26}/></div></div>{msg&&<div className={`alert ${msg.toLowerCase().includes('success')||msg.includes('created')||msg.includes('published')?'success':'error'}`}>{msg}</div>}<div className="dash-tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>Overview</button><button className={tab==='store'?'active':''} onClick={()=>setTab('store')}>Storefront</button><button className={tab==='product'?'active':''} onClick={()=>setTab('product')}>Add product</button></div>{tab==='overview'&&<div className="dashboard-grid"><div className="metric-card"><span>Storefronts</span><strong>{stores.length}</strong><small>Connected to DukaFine</small></div><div className="metric-card"><span>Checkout</span><strong>M-Pesa</strong><small>Configured in backend</small></div><div className="metric-card"><span>Growth</span><strong>Online</strong><small>Share products with customers</small></div><div className="workspace-card"><div><span className="eyebrow">Quick start</span><h2>Get your first product online</h2><p>Create a storefront, then publish products with a price, stock count and image.</p></div><div className="quick-actions"><Button onClick={()=>setTab('store')}>Create storefront</Button><Button variant="outline" onClick={()=>setTab('product')}>Add product</Button></div></div></div>}{tab==='store'&&<div className="two-col"><form onSubmit={createStore} className="form-card"><span className="eyebrow">New storefront</span><h2>Create a store</h2><div className="form-stack">{[['name','Store name'],['till_number','Buy Goods Till'],['phone_number','Seller phone'],['email','Seller email']].map(([k,l])=><Field key={k} label={l}><input required value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={l}/></Field>)}<Button className="wide-action">Create store</Button></div></form><div className="list-card"><span className="eyebrow">Your stores</span><h2>Storefronts</h2>{stores.length?<div className="store-list">{stores.map(s=><div className="store-list-item" key={s._id}><div className="store-avatar"><Icon name="store"/></div><div><strong>{s.vendor_name}</strong><small>Till {s.till_number || '—'} · {s.phone_number || '—'}</small></div></div>)}</div>:<p className="muted">No storefronts yet.</p>}</div></div>}{tab==='product'&&<div className="two-col"><form onSubmit={createProduct} className="form-card"><span className="eyebrow">Catalog</span><h2>Publish a product</h2><div className="form-stack"><Field label="Store"><select required value={product.store_id} onChange={e=>setProduct({...product,store_id:e.target.value})}><option value="">Select storefront</option>{stores.map(s=><option key={s._id} value={s._id}>{s.vendor_name}</option>)}</select></Field><Field label="Product name"><input required value={product.name} onChange={e=>setProduct({...product,name:e.target.value})}/></Field><div className="form-row"><Field label="Price (KSh)"><input required type="number" min="0" value={product.price} onChange={e=>setProduct({...product,price:e.target.value})}/></Field><Field label="Stock"><input required type="number" min="0" value={product.quantity} onChange={e=>setProduct({...product,quantity:e.target.value})}/></Field></div><Field label="Image URL"><input required value={product.image_url} onChange={e=>setProduct({...product,image_url:e.target.value})} placeholder="https://..."/></Field><Field label="Description"><textarea rows="5" value={product.description} onChange={e=>setProduct({...product,description:e.target.value})}/></Field><Button className="wide-action">Publish product <Icon name="arrow"/></Button></div></form><div className="info-card"><div className="info-icon"><Icon name="chart"/></div><h2>Product checklist</h2><p>Clear product names and accurate stock counts help customers buy with confidence.</p><ul><li>Use a bright, clear product image.</li><li>Keep the price and stock count accurate.</li><li>Write a short description that answers key questions.</li></ul></div></div>}</div></Layout>
}

function Admin() {
  const [stats,setStats]=useState(null),[orders,setOrders]=useState([]),[logs,setLogs]=useState([]),[stores,setStores]=useState([]),[error,setError]=useState('')
  const load=()=>Promise.all([api('/admin/stats'),api('/admin/orders'),api('/admin/logs'),api('/admin/stores')]).then(([a,b,c,d])=>{setStats(a);setOrders(b.orders||[]);setLogs(c.logs||[]);setStores(d.stores||[])}).catch(e=>setError(e.message))
  useEffect(()=>{load()},[])
  return <Layout><div className="container page-space"><div className="dashboard-header"><div><span className="eyebrow">Administration</span><h1>Control center</h1><p>Monitor marketplace activity, orders, stores and audit events.</p></div><button className="icon-button refresh-button" onClick={load}><Icon name="refresh"/></button></div>{error&&<div className="alert error">{error}</div>}{stats&&<div className="admin-stats">{[['Users',stats.users],['Stores',stats.stores],['Products',stats.products],['Orders',stats.orders],['Paid orders',stats.paid_orders],['Revenue',money(stats.revenue)]].map(([a,b])=><div className="metric-card" key={a}><span>{a}</span><strong>{b}</strong><small>Current database totals</small></div>)}</div>}<div className="admin-grid"><div className="table-card"><div className="card-heading"><div><span className="eyebrow">Transactions</span><h2>Recent orders</h2></div></div><div className="table-scroll"><table><thead><tr><th>Order</th><th>Status</th><th>Amount</th></tr></thead><tbody>{orders.slice(0,20).map(o=><tr key={o._id}><td><strong>{o.order_number}</strong></td><td><span className={`status ${o.status}`}>{o.status}</span></td><td>{money(o.amount)}</td></tr>)}</tbody></table></div></div><div className="table-card"><div className="card-heading"><div><span className="eyebrow">Stores</span><h2>Merchant list</h2></div></div><div className="admin-list">{stores.slice(0,20).map(s=><div key={s._id}><span className="store-avatar"><Icon name="store" size={16}/></span><div><strong>{s.vendor_name}</strong><small>Till {s.till_number || '—'}</small></div></div>)}</div></div><div className="table-card logs-card"><div className="card-heading"><div><span className="eyebrow">Security</span><h2>Audit log</h2></div></div><div className="log-list">{logs.slice(0,30).map(l=><div key={l._id}><span className="log-dot"></span><div><strong>{l.action}</strong><small>{l.actor_email || 'system'} · {new Date(l.created_at).toLocaleString()}</small></div></div>)}</div></div></div></div></Layout>
}

function Account() {
  const [user,setUser]=useState(null)
  useEffect(()=>{api('/auth/me').then(x=>setUser(x.user)).catch(()=>{})},[])
  const logout=()=>{localStorage.removeItem('dukafine_token');location.href='/'}
  return <Layout><div className="container narrow page-space"><div className="account-card"><div className="account-avatar">{(user?.name||'U').slice(0,1).toUpperCase()}</div><span className="eyebrow">My account</span><h1>{user?.name || 'Account'}</h1><p className="account-email">{user?.email}</p><div className="account-details"><div><Icon name="mail"/><span><small>Email</small><strong>{user?.email || '—'}</strong></span></div><div><Icon name="phone"/><span><small>Phone</small><strong>{user?.phone_number || '—'}</strong></span></div><div><Icon name="shield"/><span><small>Role</small><strong>{user?.role || 'customer'}</strong></span></div></div><Button variant="danger" onClick={logout}><Icon name="logout"/> Sign out</Button></div></div></Layout>
}

function NotFound() {
  return <Layout><div className="container narrow page-space"><div className="empty-state large"><div className="empty-icon"><Icon name="x" size={30}/></div><span className="eyebrow">404</span><h1>Page not found</h1><p>The page may have moved or the link may be incorrect.</p><Link className="btn btn-primary" to="/">Back to marketplace</Link></div></div></Layout>
}

function App() {
  const [cart,setCart]=useState(()=>{try{return JSON.parse(localStorage.getItem('dukafine_cart')||'[]')}catch{return []}})
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

export default App
