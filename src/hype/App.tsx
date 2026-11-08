// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { HYPE_LOGO } from './logo';
import { processStudioImage, type StudioOptions } from './imageStudio';
import { ConditionsDeVente } from './ConditionsDeVente';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { normalizeWhatsapp, deliveryFee, variantPrice, orderMessage, type DeliveryZone } from './commerce';

declare global {
  interface Window {
    emailjs?: {
      send: (
        serviceId: string,
        templateId: string,
        templateParams: Record<string, unknown>,
        options?: { publicKey: string }
      ) => Promise<unknown>;
    };
  }
}

export interface ProductColor {
  n: string; // Nom de la couleur, ex: "Noir Onyx"
  h: string; // Code couleur hex, ex: "#0A0A0A"
  i: string[]; // URLs ou data-URLs des photos
  st: number | Record<string, number>; // Stock global ou par taille
  p?: number; // Prix spécifique de cette variante
}

export interface RawProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  original_price?: number; // Prix d'origine barré pour les promotions
  descr: string;
  badge?: string; // "DROP" | "PROMOTION" | "BEST SELLERS" | "DISPONIBLE DE SUITE" | "" | custom
  visible: boolean;
  sizes: string[]; // ["XS", "S", "M", "L", "XL", "XXL"] ou []
  colors: ProductColor[];
}

export interface CatalogProduct {
  id: number;
  n: string;
  c: string;
  p: number;
  op?: number; // Prix original barré
  badge?: string;
  d: string;
  sz: string[] | null;
  cols: ProductColor[];
}

export interface CartItem {
  id: number;
  c: number;
  s: string | null;
  q: number;
}

export interface OrderItem {
  id: number;
  name: string;
  color: string;
  colorHex?: string;
  size: string | null;
  price: number;
  q: number;
}

export interface Order {
  id: number;
  no: string;
  created_at: string;
  name: string;
  whatsapp: string;
  address: string;
  notes: string;
  items: OrderItem[];
  pay_mode: '50' | '100';
  paid: number;
  balance: number;
  total: number;
  mvola_ref: string;
  status: string; // 'En attente de paiement' | 'Paiement vérifié' | 'En livraison' | 'Livrée' | 'Annulée'
}

export interface SecurityLog {
  id: number;
  timestamp: string;
  email: string;
  event: string;
  details: string;
  code?: string;
  status: 'warning' | 'success' | 'danger';
}

export interface VerificationChallengeState {
  challengeId: string;
  email: string;
  code: string;
  expiresAt: number;
  message: string;
  emailJsSent: boolean;
  sentAtFormatted: string;
}

const EJ = {
  s: 'service_hype',
  t: 'template_c0al9be',
  k: 's93Y_eEOREX9zxNee',
};
const LIV = 3000;
const WA = '261381221950';
const ADMIN_EMAIL = 'ramamonjymarielle@gmail.com';
const ST = [
  'En attente de paiement',
  'Paiement vérifié',
  'En livraison',
  'Livrée',
  'Annulée',
];

const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PRESET_BADGES = [
  { label: 'Aucune étiquette', val: '' },
  { label: 'DROP (Série limitée)', val: 'DROP' },
  { label: 'PROMOTION', val: 'PROMOTION' },
  { label: 'BEST SELLERS', val: 'BEST SELLERS' },
  { label: 'DISPONIBLE DE SUITE', val: 'DISPONIBLE DE SUITE' },
];

const INITIAL_PRODUCTS: RawProduct[] = [
  {
    id: 1,
    name: 'Hoodie Oversize HYPE "Red Emblem"',
    category: 'Hoodies',
    price: 95000,
    descr: 'Coton lourd 450 GSM coupe boxy oversize. Broderie poitrine HYPE rouge sang, finitions bords-côtes renforcés. Série limitée Antananarivo.',
    badge: 'DROP',
    visible: true,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      {
        n: 'Noir Onyx',
        h: '#0A0A0A',
        i: ['/images/hype_hoodie_black_1793613616909.jpg'],
        st: { S: 3, M: 5, L: 4, XL: 2 },
      },
      {
        n: 'Gris Cendre',
        h: '#555555',
        i: ['/images/hype_hoodie_black_1793613616909.jpg'],
        st: { S: 2, M: 3, L: 2, XL: 1 },
      },
    ],
  },
  {
    id: 2,
    name: 'T-Shirt Heavy Drop "Urban Architecture"',
    category: 'T-shirts',
    price: 55000,
    descr: 'T-shirt streetwear coupe large épaules tombantes en jersey 280 GSM peigné. Sérigraphie haute densité poitrine, col montant épais indéformable.',
    badge: 'BEST SELLERS',
    visible: true,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      {
        n: 'Charbon',
        h: '#18181B',
        i: ['/images/hype_tshirt_urban_1793613618017.jpg'],
        st: { S: 4, M: 6, L: 5, XL: 3, XXL: 2 },
      },
      {
        n: 'Blanc Pur',
        h: '#FFFFFF',
        i: ['/images/hype_tshirt_urban_1793613618017.jpg'],
        st: { S: 3, M: 4, L: 3, XL: 1, XXL: 1 },
      },
    ],
  },
  {
    id: 3,
    name: 'Sac Tactical Crossbody HYPE',
    category: 'Sacs',
    price: 68000,
    descr: 'Sac bandoulière technique en nylon balistique déperlant. Boucles rapides noir mat, sangle tissée ajustable, compartiments zippés sécurisés.',
    badge: 'DISPONIBLE DE SUITE',
    visible: true,
    sizes: [],
    colors: [
      {
        n: 'Noir Mat',
        h: '#0A0A0A',
        i: ['/images/hype_tactical_bag_1793613618720.jpg'],
        st: 6,
      },
      {
        n: 'Kaki Militaire',
        h: '#3B4D3C',
        i: ['/images/hype_tactical_bag_1793613618720.jpg'],
        st: 4,
      },
    ],
  },
  {
    id: 4,
    name: 'Casquette 6-Panel "Stay Ahead"',
    category: 'Casquettes',
    price: 42000,
    original_price: 55000,
    descr: 'Casquette structurée 6 panneaux en sergé de coton épais. Broderie ton sur ton en relief à l’avant, boucle métallique de serrage à l’arrière.',
    badge: 'PROMOTION',
    visible: true,
    sizes: [],
    colors: [
      {
        n: 'Noir Ton sur Ton',
        h: '#0A0A0A',
        i: ['/images/hype_cap_street_1793613618946.jpg'],
        st: 8,
      },
    ],
  },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 101,
    no: 'HP-2401',
    created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    name: 'Tahina Randria',
    whatsapp: '0341892045',
    address: 'Ankorondrano près de la Tour Zital, Antananarivo',
    notes: 'Appeler 15 min avant de passer',
    items: [
      {
        id: 1,
        name: 'Hoodie Oversize HYPE "Red Emblem"',
        color: 'Noir Onyx',
        colorHex: '#0A0A0A',
        size: 'L',
        price: 95000,
        q: 1,
      },
      {
        id: 4,
        name: 'Casquette 6-Panel "Stay Ahead"',
        color: 'Noir Ton sur Ton',
        colorHex: '#0A0A0A',
        size: null,
        price: 42000,
        q: 1,
      },
    ],
    pay_mode: '50',
    paid: 70000,
    balance: 70000,
    total: 140000,
    mvola_ref: 'MV84920174',
    status: 'En attente de paiement', // Devra être coloré en ROUGE
  },
  {
    id: 102,
    no: 'HP-2402',
    created_at: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    name: 'Miora Rakoto',
    whatsapp: '0384511290',
    address: 'Ivandry arrêt Pullman, Antananarivo',
    notes: 'Paiement effectué ce matin',
    items: [
      {
        id: 3,
        name: 'Sac Tactical Crossbody HYPE',
        color: 'Kaki Militaire',
        colorHex: '#3B4D3C',
        size: null,
        price: 68000,
        q: 1,
      },
    ],
    pay_mode: '100',
    paid: 71000,
    balance: 0,
    total: 71000,
    mvola_ref: 'MV99283105',
    status: 'Paiement vérifié', // Devra être coloré en VERT
  },
  {
    id: 103,
    no: 'HP-2403',
    created_at: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
    name: 'Faly Andria',
    whatsapp: '0327654321',
    address: 'Ambohijatovo en face du jardin, Antananarivo',
    notes: 'Livraison express',
    items: [
      {
        id: 2,
        name: 'T-Shirt Heavy Drop "Urban Architecture"',
        color: 'Blanc Pur',
        colorHex: '#FFFFFF',
        size: 'M',
        price: 55000,
        q: 2,
      },
    ],
    pay_mode: '100',
    paid: 113000,
    balance: 0,
    total: 113000,
    mvola_ref: 'MV11829304',
    status: 'En livraison', // Devra être coloré en BLEU
  },
  {
    id: 104,
    no: 'HP-2404',
    created_at: new Date(Date.now() - 3600 * 1000 * 60).toISOString(),
    name: 'Soa Rasoanaivo',
    whatsapp: '0331122334',
    address: 'Isoraka près de l’Hôtel Colbert, Antananarivo',
    notes: 'Colis bien réceptionné',
    items: [
      {
        id: 1,
        name: 'Hoodie Oversize HYPE "Red Emblem"',
        color: 'Gris Cendre',
        colorHex: '#555555',
        size: 'S',
        price: 95000,
        q: 1,
      },
    ],
    pay_mode: '100',
    paid: 98000,
    balance: 0,
    total: 98000,
    mvola_ref: 'MV33445566',
    status: 'Livrée', // Devra être coloré en BLANC
  },
];

const formatAr = (n: number) =>
  String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar';

const loadLocal = <T,>(k: string, d: T): T => {
  try {
    const val = localStorage.getItem(k);
    return val ? JSON.parse(val) : d;
  } catch {
    return d;
  }
};

const saveLocal = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // Ignore storage errors
  }
};

const stk = (c: ProductColor, s?: string | null): number =>
  typeof c.st === 'object' && c.st !== null ? Number((s && c.st[s]) || 0) : Number(c.st || 0);

const tot = (c: ProductColor, p: CatalogProduct): number =>
  p.sz ? p.sz.reduce((a, s) => a + stk(c, s), 0) : stk(c);

const totalColorStock = (c: ProductColor): number =>
  typeof c.st === 'object' && c.st !== null
    ? Object.values(c.st).reduce((a, b) => a + (Number(b) || 0), 0)
    : Number(c.st || 0);

function generate6DigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Convert image file to compressed base64 data URL
const compressImageFile = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1000;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

export function App() {
  // Products and persistence
  const [rawProducts, setRawProductsState] = useState<RawProduct[]>(() =>
    loadLocal('hype_products_cache_v4', INITIAL_PRODUCTS)
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('data, sort').order('sort');
    if (!error && data) {
      const list = data.map((r: any) => r.data as RawProduct);
      setRawProductsState(list);
      saveLocal('hype_products_cache_v4', list);
    }
  };

  // Persist before displaying success; side effects never run inside a React state updater.
  const setRawProducts = async (updater: (prev: RawProduct[]) => RawProduct[]) => {
    if (!isAdmin) throw new Error('Connexion administrateur requise.');
    const next = updater(structuredClone(rawProducts));
    const removed = rawProducts.filter(p => !next.some(n => n.id === p.id)).map(p => p.id);
    const changed = next.map((p, sort) => ({ p, sort })).filter(({ p }) => {
      const old = rawProducts.find(o => o.id === p.id);
      return !old || JSON.stringify(old) !== JSON.stringify(p);
    });
    if (removed.length) {
      const { error } = await supabase.from('products').delete().in('id', removed);
      if (error) throw error;
    }
    if (changed.length) {
      const { error } = await supabase.from('products').upsert(changed.map(({ p, sort }) => ({ id: p.id, data: p, sort, updated_at: new Date().toISOString() })));
      if (error) throw error;
    }
    await fetchProducts();
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (!error && data) setOrders(data as any);
  };

  useEffect(() => {
    fetchProducts();
    const checkAdmin = async (session: any) => {
      if (!session?.user) {
        setIsAdmin(false);
        setOrders([]);
        setAdmMode('login');
        return;
      }
      const { data } = await supabase.rpc('has_role', { _user_id: session.user.id, _role: 'admin' });
      setIsAdmin(!!data);
      if (data) {
        setAdmMode('dashboard');
        fetchOrders();
      }
    };
    supabase.auth.getUser().then(({ data }) => checkAdmin(data.user ? { user: data.user } : null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => checkAdmin(session), 0);
    });
    const channel = supabase
      .channel('hype-products-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .subscribe();
    return () => {
      sub.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // Refresh orders regularly while the admin dashboard is open
  useEffect(() => {
    if (!isAdmin) return;
    fetchOrders();
    const channel = supabase.channel('hype-orders-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>(() =>
    loadLocal('hype_sec_logs_v3', [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        email: ADMIN_EMAIL,
        event: 'password_login',
        details: 'Protection par code e-mail de sécurité activée pour le compte admin.',
        status: 'success',
      },
    ])
  );
  useEffect(() => {
    saveLocal('hype_sec_logs_v3', securityLogs);
  }, [securityLogs]);

  // Catalog state
  const [cart, setCart] = useState<CartItem[]>(() => loadLocal('h_cart_fresh_1', []));
  const [fav, setFav] = useState<number[]>(() => loadLocal('h_fav_fresh_1', []));
  const [cat, setCat] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Alternance / Rotation automatique des produits pour que tous les articles soient découverts
  const [catalogRotationOffset, setCatalogRotationOffset] = useState<number>(() => {
    return Math.floor(Math.random() * 4);
  });

  // Rotation automatique régulière (toutes les 12 secondes) : pas besoin de bouton
  useEffect(() => {
    const timer = setInterval(() => {
      setCatalogRotationOffset((prev) => prev + 1);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const catalog: CatalogProduct[] = rawProducts
    .filter((p) => p.visible !== false)
    .map((r) => ({
      id: r.id,
      n: r.name,
      c: r.category,
      p: r.price,
      op:
        r.original_price ||
        (r.badge === 'PROMOTION' && r.price ? Math.round((r.price * 1.3) / 1000) * 1000 : undefined),
      badge: r.badge,
      d: r.descr,
      sz: r.sizes && r.sizes.length ? r.sizes : null,
      cols: r.colors,
    }));

  // Rotated catalog for fair visibility across all articles
  const rotatedCatalog = [...catalog];
  if (rotatedCatalog.length > 1) {
    const shift = catalogRotationOffset % rotatedCatalog.length;
    if (shift > 0) {
      const moved = rotatedCatalog.splice(0, shift);
      rotatedCatalog.push(...moved);
    }
  }

  // Hero slideshow state
  const [heroIdx, setHeroIdx] = useState<number>(0);
  const [heroFade, setHeroFade] = useState<boolean>(true);

  const heroSlides = catalog.flatMap((p) =>
    p.cols.filter((c) => c.i && c.i[0]).map((c) => ({ s: c.i[0], id: p.id }))
  );

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const timer = setInterval(() => {
      setHeroFade(false);
      setTimeout(() => {
        setHeroIdx((prev) => (prev + 1) % heroSlides.length);
        setHeroFade(true);
      }, 300);
    }, 4000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  // Product modal (#m) state
  const [curProd, setCurProd] = useState<CatalogProduct | null>(null);
  const [ci, setCi] = useState<number>(0);
  const [sz, setSz] = useState<string | null>(null);
  const [im, setIm] = useState<number>(0);
  const pointerStartX = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Cart & Checkout Drawer (#d) state
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerView, setDrawerView] = useState<'cart' | 'co' | 'ok'>('cart');
  const [coZone, setCoZone] = useState<DeliveryZone | ''>('');
  const shippingFee = deliveryFee(coZone);
  const [coName, setCoName] = useState<string>('');
  const [coWa, setCoWa] = useState<string>('');
  const [coWaConfirm, setCoWaConfirm] = useState<boolean>(false);
  const [coAddr, setCoAddr] = useState<string>('');
  const [coNotes, setCoNotes] = useState<string>('');
  const [coPayMode, setCoPayMode] = useState<'50' | '100' | ''>('');
  const [coMvolaRef, setCoMvolaRef] = useState<string>('');
  const [coTerms, setCoTerms] = useState<boolean>(false);
  const [coErrors, setCoErrors] = useState<string[]>([]);
  const [coSubmitting, setCoSubmitting] = useState<boolean>(false);
  const [lastOrder, setLastOrder] = useState<{ no: string; url: string }>({ no: '', url: '' });

  // Admin (#admin) route & authentication state
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => window.location.hash === '#admin');
  const [admMode, setAdmMode] = useState<
    'login' | 'verify-code' | 'forgot' | 'dashboard'
  >('login');
  const [admEmail, setAdmEmail] = useState<string>('ramamonjymarielle@gmail.com');
  const [admPass, setAdmPass] = useState<string>('');
  const [admMsg, setAdmMsg] = useState<string>('');
  const [admBusy, setAdmBusy] = useState<boolean>(false);

  // Wrong-password email verification challenge state
  const [challenge, setChallenge] = useState<VerificationChallengeState | null>(null);
  const [verificationCodeInput, setVerificationCodeInput] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [wantUpdatePassAfterCode, setWantUpdatePassAfterCode] = useState<boolean>(false);
  const [newPassAfterCode, setNewPassAfterCode] = useState<string>('');

  // Admin dashboard state
  const [admTab, setAdmTab] = useState<'o' | 'p' | 's'>('o');
  const [admShowCancelled, setAdmShowCancelled] = useState<boolean>(false);
  const [admEditingProd, setAdmEditingProd] = useState<Partial<RawProduct> | null>(null);
  const [admProdError, setAdmProdError] = useState<string>('');
  const [admVerifyBanner, setAdmVerifyBanner] = useState<string>('');
  const [customBadgeInput, setCustomBadgeInput] = useState<string>('');

  // Studio photo processing state
  const [studioMode, setStudioMode] = useState<StudioOptions['mode']>('cover');
  const [studioRemoveBg, setStudioRemoveBg] = useState<boolean>(false);
  const [studioProcessing, setStudioProcessing] = useState<boolean>(false);

  // Password reset fields in security tab
  const [newPasswordSetting1, setNewPasswordSetting1] = useState<string>('');
  const [newPasswordSetting2, setNewPasswordSetting2] = useState<string>('');

  // Listen to hash change for #admin
  useEffect(() => {
    const handleHash = () => {
      const onAdmin = window.location.hash === '#admin';
      setIsAdminRoute(onAdmin);

    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Verification countdown timer
  useEffect(() => {
    if (admMode !== 'verify-code' || !challenge) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((challenge.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(left);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [admMode, challenge]);

  // Keyboard navigation for modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!curProd) return;
      if (e.key === 'ArrowRight') switchSlide(1);
      else if (e.key === 'ArrowLeft') switchSlide(-1);
      else if (e.key === 'Escape') setCurProd(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Authentication is verified by Cloud; no password or verification code is stored locally.
  const openAdminSession = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;
    const { data, error } = await supabase.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (error || !data) {
      await supabase.auth.signOut();
      setAdmMsg('Ce compte ne possède pas les droits administrateur.');
      return false;
    }
    setIsAdmin(true);
    setAdmMode('dashboard');
    setAdmPass('');
    await fetchOrders();
    return true;
  };

  const sendEmailAccess = async () => {
    setAdmBusy(true);
    setAdmMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: ADMIN_EMAIL,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + '/#admin' },
    });
    if (error) {
      setAdmMsg('Envoi impossible : ' + error.message + '. Pour un premier accès, créez votre compte administrateur.');
    } else {
      setChallenge({ email: ADMIN_EMAIL, expiresAt: Date.now() + 3600000, message: 'Un e-mail de connexion sécurisé vient d’être envoyé. Utilisez le lien reçu ou le code contenu dans cet e-mail.', emailJsSent: true });
      setAdmMode('verify-code');
    }
    setAdmBusy(false);
  };
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdmBusy(true);
    setAdmMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email: admEmail.trim(), password: admPass });
    if (error) {
      setAdmBusy(false);
      if (admEmail.trim().toLowerCase() === ADMIN_EMAIL) await sendEmailAccess();
      else setAdmMsg('Identifiants invalides.');
      return;
    }
    await openAdminSession();
    setAdmBusy(false);
  };
  const handleCreateAdminAccount = async () => {
    if (admEmail.trim().toLowerCase() !== ADMIN_EMAIL || admPass.length < 8) {
      setAdmMsg('Utilisez votre adresse administrateur et un nouveau mot de passe d’au moins 8 caractères.');
      return;
    }
    setAdmBusy(true);
    const { error } = await supabase.auth.signUp({ email: ADMIN_EMAIL, password: admPass, options: { emailRedirectTo: window.location.origin + '/#admin' } });
    setAdmMsg(error ? error.message : 'Vérifiez votre boîte e-mail pour confirmer votre compte, puis connectez-vous.');
    setAdmBusy(false);
  };
  const handleResendCode = sendEmailAccess;
  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdmBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: ADMIN_EMAIL, token: verificationCodeInput.trim(), type: 'email' });
    if (error) setAdmMsg('Code invalide ou expiré. Utilisez le dernier e-mail reçu.');
    else {
      if (wantUpdatePassAfterCode && newPassAfterCode.length >= 8) {
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassAfterCode });
        if (updateError) setAdmMsg(updateError.message);
      }
      await openAdminSession();
      setChallenge(null);
    }
    setAdmBusy(false);
  };
  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setOrders([]);
    setAdmEditingProd(null);
    setChallenge(null);
    setAdmMode('login');
  };
  const handleSendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setWantUpdatePassAfterCode(true);
    await sendEmailAccess();
  };
  const handleUpdatePasswordInSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordSetting1.length < 8 || newPasswordSetting1 !== newPasswordSetting2) {
      setAdmMsg('Les mots de passe doivent être identiques et comporter au moins 8 caractères.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPasswordSetting1 });
    setAdmMsg(error ? error.message : 'Nouveau mot de passe enregistré.');
    if (!error) { setNewPasswordSetting1(''); setNewPasswordSetting2(''); }
  };

  // Storefront interactions
  const toggleFav = (id: number) => {
    setFav((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveLocal('h_fav_fresh_1', next);
      return next;
    });
  };

  const openProduct = (id: number) => {
    const found = catalog.find((p) => p.id === id);
    if (!found) return;
    setCurProd(found);
    setCi(0);
    setSz(null);
    setIm(0);
  };

  const getProductSeq = (p: CatalogProduct) =>
    p.cols.flatMap((c, a) => (c.i || []).map((_u, k) => ({ ci: a, k })));

  const switchSlide = (d: number) => {
    if (!curProd) return;
    const c = curProd.cols[ci] || curProd.cols[0];
    if (!c || !c.i || c.i.length <= 1) return;
    setIm((prev) => (prev + d + c.i.length) % c.i.length);
  };

  const addToCart = () => {
    if (!curProd) return;
    const c = curProd.cols[ci];
    const mx = curProd.sz ? stk(c, sz) : stk(c);
    setCart((prev) => {
      const next = [...prev];
      const existing = next.find(
        (x) => x.id === curProd.id && x.c === ci && x.s === sz
      );
      if (existing) {
        if (existing.q < mx) existing.q += 1;
      } else {
        next.push({ id: curProd.id, c: ci, s: sz, q: 1 });
      }
      saveLocal('h_cart_fresh_1', next);
      return next;
    });
    setCurProd(null);
    setDrawerView('cart');
    setDrawerOpen(true);
  };

  const lookupCartItem = (x: CartItem) => {
    const p = catalog.find((a) => a.id === x.id);
    if (!p) return null;
    const c = p.cols[x.c];
    if (!c) return null;
    return { p, c, mx: x.s ? stk(c, x.s) : stk(c) };
  };

  const updateCartQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const item = next[idx];
      if (!item) return prev;
      const info = lookupCartItem(item);
      const mx = info ? info.mx : 1;
      const newQ = delta === -99 ? 0 : Math.min(mx, item.q + delta);
      if (newQ <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...item, q: newQ };
      }
      saveLocal('h_cart_fresh_1', next);
      return next;
    });
  };

  const cartSubtotal = cart.reduce((acc, x) => {
    const info = lookupCartItem(x);
    return acc + (info ? variantPrice(info.p.p, info.c) * x.q : 0);
  }, 0);

  const getPaymentSummary = () => {
    const t = cartSubtotal + shippingFee;
    if (!coPayMode) return null;
    return {
      v: coPayMode,
      t,
      paid: coPayMode === '50' ? Math.round(cartSubtotal / 2) : cartSubtotal,
    };
  };

  const handleSendOrder = async () => {
    const w = normalizeWhatsapp(coWa);
    const a = getPaymentSummary();
    const errs: string[] = [];

    if (coName.trim().length < 3) errs.push('Écris ton nom complet.');
    if (!w) {
      errs.push('Numéro WhatsApp invalide : 10 chiffres (032, 033, 034, 037 ou 038).');
    }
    if (!coWaConfirm) errs.push('Confirme que ce numéro est joignable sur WhatsApp.');
    if (coAddr.trim().length < 8) errs.push('Décris ton adresse de livraison à Antananarivo.');
    if (!a) errs.push('Choisis ton mode de paiement Mvola.');
    if (!coZone) errs.push('Choisis ta zone de livraison.');
    if (coMvolaRef.trim().length < 6) errs.push('Saisis la référence de transaction Mvola.');
    if (!coTerms) errs.push("Accepte les conditions de vente pour continuer.");
    if (!cart.length) errs.push('Ton panier est vide.');

    if (errs.length) {
      setCoErrors(errs);
      return;
    }

    setCoErrors([]);
    setCoSubmitting(true);

    if (!w || !a || !coZone) { setCoSubmitting(false); return; }
    const { data, error } = await supabase.rpc('place_order', {
      _name: coName.trim(), _whatsapp: w, _address: coAddr.trim() + ', Antananarivo',
      _notes: coNotes.trim(), _zone: coZone, _pay_mode: a.v, _mvola_ref: coMvolaRef.trim(),
      _items: cart.map(item => ({ id: item.id, c: item.c, s: item.s, q: item.q })),
    });
    if (error || !data) {
      setCoErrors([error?.message || 'Commande non enregistrée. Réessayez.']);
      setCoSubmitting(false);
      await fetchProducts();
      return;
    }
    const newOrder = data as unknown as Order;
    const no = newOrder.no;
    const whatsappMsg = orderMessage(newOrder);
    await fetchProducts();
    setLastOrder({
      no,
      url: `https://wa.me/${WA}?text=${encodeURIComponent(whatsappMsg)}`,
    });
    setCart([]);
    saveLocal('h_cart_fresh_1', []);
    setDrawerView('ok');
    setCoSubmitting(false);
  };

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) { alert(error.message); return; }
    await fetchOrders();
  };

  const exportCsv = () => {
    const rows = [
      ['N°', 'Date', 'Nom', 'WhatsApp', 'Adresse', 'Produits', 'Mode', 'Payé', 'Solde', 'Total', 'Réf Mvola', 'Statut'],
      ...orders.map((o) => [
        o.no,
        o.created_at,
        o.name,
        o.whatsapp,
        o.address,
        o.items.map((i) => `${i.q}x ${i.name} ${i.color} ${i.size || ''}`).join(' | '),
        o.pay_mode,
        o.paid,
        o.balance,
        o.total,
        o.mvola_ref,
        o.status,
      ]),
    ];
    const csvContent = rows
      .map((l) => l.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(';'))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csvContent], { type: 'text/csv' }));
    a.download = 'commandes-hype.csv';
    a.click();
  };

  // Helper for Order Card Visual Styling requested by user:
  // "en attente de paiement" -> ROUGE
  // "paiement verifié" -> VERT
  // "en livraison" -> BLEU
  // "livré" -> BLANC
  const getOrderStatusConfig = (status: string) => {
    const key = status === 'En attente de paiement' ? 'pending' : status === 'Paiement vérifié' ? 'verified' : status === 'En livraison' ? 'shipping' : status === 'Livrée' ? 'delivered' : 'cancelled';
    return { cardClass: `order-card order-${key}`, badgeClass: `order-badge order-badge-${key}`, tagLabel: status.toUpperCase() };
  };

  // Photo upload from gallery for color with professional studio processing (no deformation & auto bg removal)
  const handleUploadGalleryPhotos = async (colorIdx: number, files: FileList | null) => {
    if (!files || !files.length || !admEditingProd) return;
    try {
      setStudioProcessing(true);
      const readUrls: string[] = [];
      for (const file of Array.from(files)) {
        const processed = await processStudioImage(file, {
          mode: studioMode,
          removeBg: studioRemoveBg,
          targetSize: 1000,
        });
        readUrls.push(processed);
      }
      const updatedColors = [...(admEditingProd.colors || [])];
      updatedColors[colorIdx] = {
        ...updatedColors[colorIdx],
        i: [...(updatedColors[colorIdx].i || []), ...readUrls],
      };
      setAdmEditingProd({ ...admEditingProd, colors: updatedColors });
    } catch (e: any) {
      setAdmProdError(e?.message || 'Erreur lors du traitement photo studio.');
    } finally {
      setStudioProcessing(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!admEditingProd) return;
    const name = (admEditingProd.name || '').trim();
    const category = (admEditingProd.category || '').trim();
    const price = Number(admEditingProd.price || 0);
    const original_price = admEditingProd.original_price ? Number(admEditingProd.original_price) : undefined;
    const colors = admEditingProd.colors || [];

    if (!name || !category || !(price > 0)) {
      setAdmProdError('Nom, catégorie et prix sont obligatoires.');
      return;
    }

    if (!colors.length) {
      setAdmProdError('Veuillez ajouter au moins une couleur.');
      return;
    }

    if (colors.some((c) => !c.n.trim())) {
      setAdmProdError('Veuillez donner un nom à chaque couleur.');
      return;
    }

    if (colors.some(c => c.p !== undefined && (!Number.isFinite(c.p) || c.p <= 0))) { setAdmProdError('Le prix spécifique doit être supérieur à zéro.'); return; }
    const badgeValue = (admEditingProd.badge || customBadgeInput || '').trim();

    try {
    await setRawProducts((prev) => {
      const copy = [...prev];
      if (admEditingProd.id) {
        const idx = copy.findIndex((p) => p.id === admEditingProd.id);
        if (idx !== -1) {
          copy[idx] = {
            id: admEditingProd.id,
            name,
            category,
            price,
            original_price,
            descr: admEditingProd.descr || '',
            badge: badgeValue,
            visible: admEditingProd.visible !== false,
            sizes: admEditingProd.sizes || [],
            colors,
          };
        }
      } else {
        const nextId = copy.length ? Math.max(...copy.map((p) => p.id)) + 1 : 1;
        copy.push({
          id: nextId,
          name,
          category,
          price,
          original_price,
          descr: admEditingProd.descr || '',
          badge: badgeValue,
          visible: admEditingProd.visible !== false,
          sizes: admEditingProd.sizes || [],
          colors,
        });
      }
      return copy;
    });

    setAdmEditingProd(null);
    setAdmProdError('');
    setCustomBadgeInput('');
    } catch (error) { setAdmProdError(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
  };

  const handleDeleteProduct = async (id: number) => {
    if (window.confirm('Confirmer la suppression de cet article ?')) {
      try { await setRawProducts((prev) => prev.filter((p) => p.id !== id)); } catch (error) { alert(error.message); }
    }
  };

  // Filtered products for storefront based on rotation & category
  const categories = ['Tous', ...Array.from(new Set(catalog.map((p) => p.c))), '♥'];
  const filteredProducts = rotatedCatalog.filter(
    (p) =>
      (cat === 'Tous' || (cat === '♥' ? fav.includes(p.id) : p.c === cat)) &&
      p.n.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCartItems = cart.reduce((a, x) => a + x.q, 0);

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Helper for badge style
  const getBadgeStyle = (badgeText?: string) => {
    if (!badgeText) return null;
    const upper = badgeText.toUpperCase();
    if (upper.includes('DROP')) {
      return 'bg-[var(--red)] text-white';
    }
    if (upper.includes('PROMOTION') || upper.includes('PROMO')) {
      return 'bg-amber-600 text-white';
    }
    if (upper.includes('BEST') || upper.includes('SELLER')) {
      return 'bg-neutral-900 text-amber-300 border border-amber-400/40';
    }
    if (upper.includes('DISPONIBLE')) {
      return 'bg-emerald-600 text-white';
    }
    return 'bg-[var(--red)] text-white';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--fg)]">
      {/* 1. TOP BAR */}
      <header className="sticky top-0 z-30 bg-[var(--bg)]/95 backdrop-blur-md border-b border-[var(--ln)]">
        <div className="wrap flex items-center justify-between gap-3 h-14 sm:h-16 px-3 sm:px-4">
          {/* Brand Logo */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = '';
              setIsAdminRoute(false);
            }}
            className="flex items-center gap-2 shrink-0 select-none active:opacity-80"
            aria-label="HYPE Accueil"
          >
            <img
              src={HYPE_LOGO}
              alt="HYPE"
              className="h-7 sm:h-8 w-auto rounded-md object-contain"
            />
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a
              href="#cat"
              onClick={() => setCat('Tous')}
              className="hover:underline text-[var(--fg)]"
            >
              Le Drop
            </a>
            <a href="#cgv" className="hover:underline text-[var(--fg)]">
              Conditions
            </a>
            <a href="#faq" className="hover:underline text-[var(--fg)]">
              Questions fréquentes
            </a>
            <a href="#insta" className="hover:underline text-[var(--fg)]">
              @hype.mg
            </a>
            <a
              href="#admin"
              onClick={() => {
                window.location.hash = 'admin';
                setIsAdminRoute(true);
              }}
              className="hover:underline text-[var(--fg)]"
            >
              Admin
            </a>
          </nav>

          {/* Action Icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Favorites Icon */}
            <button
              onClick={() => {
                setCat('♥');
                document.getElementById('cat')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-transform"
              aria-label="Favoris"
            >
              <span className="text-xl leading-none text-[var(--red)]">♡</span>
              <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 text-[10px] font-bold rounded-full bg-[var(--red)] text-white flex items-center justify-center leading-none">
                {fav.length}
              </span>
            </button>

            {/* Shopping Bag Icon */}
            <button
              onClick={() => {
                setDrawerView('cart');
                setDrawerOpen(true);
              }}
              className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-transform"
              aria-label="Panier"
            >
              <svg
                className="w-5 h-5 text-[var(--fg)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              >
                <path d="M6 7h12l1 14H5L6 7z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </svg>
              <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 text-[10px] font-bold rounded-full bg-[var(--red)] text-white flex items-center justify-center leading-none">
                {totalCartItems}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. SUB-BANNER / LIVRAISON STRIP */}
      <div className="bg-[var(--fg)] text-[var(--bg)] py-2 px-3 text-center text-[11px] sm:text-xs font-semibold tracking-wider uppercase select-none">
        Livraison dès 3 000 Ar à Antananarivo – Paiement par Mvola
      </div>

      {/* 3. MAIN STOREFRONT CONTENT */}
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="wrap py-4 sm:py-8 px-3 sm:px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 items-center">
            <div className="text-left">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-normal leading-[1.05] tracking-wide uppercase font-['Anton',sans-serif] border-l-4 border-[var(--red)] pl-3">
                Le drop streetwear à ne pas manquer
              </h1>
              <p className="text-xs sm:text-sm text-[var(--mut)] mt-2 mb-3 sm:my-4 leading-relaxed max-w-lg">
                Be hype, Stay ahead. Sacs, t-shirts, hoodies et casquettes en séries limitées à Antananarivo.
              </p>
              <div className="flex gap-2">
                <a
                  href="#cat"
                  className="inline-flex items-center justify-center h-10 sm:h-11 px-5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-[var(--red)] hover:opacity-90 active:scale-95 transition-all shadow-sm"
                >
                  Voir la collection
                </a>
              </div>
            </div>

            {/* Hero Product Showcase */}
            <div className="flex justify-center">
              <div
                className="w-full max-w-[280px] sm:max-w-[360px] md:max-w-none aspect-square rounded-lg bg-white p-3 sm:p-5 shadow-xs border border-[var(--ln)] flex items-center justify-center cursor-pointer overflow-hidden group"
                onClick={() => {
                  if (heroSlides.length && heroSlides[heroIdx]) {
                    openProduct(heroSlides[heroIdx].id);
                  }
                }}
              >
                <img
                  src={
                    heroSlides.length && heroSlides[heroIdx]
                      ? heroSlides[heroIdx].s
                      : HYPE_LOGO
                  }
                  alt="Streetwear HYPE"
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  style={{ opacity: heroFade ? 1 : 0 }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* CATALOG / DROP SECTION */}
        <section id="cat" className="wrap py-4 sm:py-6 px-3 sm:px-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-normal uppercase font-['Anton',sans-serif] tracking-wide border-b-2 border-[var(--red)] pb-0.5">
                Le drop
              </h2>
              <span className="text-[11px] text-[var(--mut)]">
                ({filteredProducts.length} articles)
              </span>
            </div>

          </div>

          {/* Horizontally Scrollable Category Bar + Search */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-3 px-3 sm:mx-0 sm:px-0">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap rounded-md border transition-colors shrink-0 active:scale-95 ${
                    c === cat
                      ? 'bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]'
                      : 'border-[var(--fg)] text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {c === '♥' ? '♥ Favoris' : c}
                </button>
              ))}
            </div>

            <div className="relative flex-1">
              <input
                id="q"
                type="search"
                placeholder="Rechercher un modèle..."
                aria-label="Rechercher"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 sm:h-10 text-xs sm:text-sm px-3 rounded-md border border-[var(--ln)] bg-[var(--card)] focus:outline-none focus:border-[var(--red)]"
              />
            </div>
          </div>

          {/* 2-COLUMN MOBILE PRODUCT GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
            {filteredProducts.length ? (
              filteredProducts.map((p) => {
                const out = p.cols.length > 0 && p.cols.every((c) => tot(c, p) === 0);
                const isFavorite = fav.includes(p.id);
                const badgeStyle = getBadgeStyle(p.badge);

                return (
                  <article
                    key={p.id}
                    className="group relative bg-[var(--card)] border border-[var(--ln)] rounded-md overflow-hidden flex flex-col justify-between transition-transform duration-150 active:scale-[0.99]"
                  >
                    {/* Square Image Box */}
                    <div
                      className="relative aspect-square w-full bg-white flex items-center justify-center p-2 cursor-pointer overflow-hidden select-none"
                      onClick={() => openProduct(p.id)}
                    >
                      <img
                        src={p.cols[0]?.i[0] || HYPE_LOGO}
                        alt={p.n}
                        loading="lazy"
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Customizable Badge decided by Admin: only shown if p.badge is set! */}
                      {p.badge && p.badge.trim() !== '' && (
                        <span
                          className={`absolute top-1.5 left-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shadow-xs ${badgeStyle}`}
                        >
                          {p.badge}
                        </span>
                      )}

                      {/* Sold Out Badge */}
                      {out && (
                        <span className="absolute bottom-1.5 left-1.5 bg-[var(--fg)] text-[var(--bg)] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                          Épuisé
                        </span>
                      )}

                      {/* FAVORITE BUTTON - MADE CLEARLY VISIBLE WITH RED CONTOUR as requested by user! */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFav(p.id);
                        }}
                        className={`absolute top-1.5 right-1.5 w-8 h-8 rounded-full border-2 border-[var(--red)] flex items-center justify-center text-sm shadow-md transition-all active:scale-90 ${
                          isFavorite
                            ? 'bg-[var(--red)] text-white'
                            : 'bg-white text-[var(--red)] hover:bg-red-50'
                        }`}
                        aria-label="Favori"
                      >
                        {isFavorite ? '♥' : '♡'}
                      </button>
                    </div>

                    {/* Product Details Info */}
                    <div
                      className="p-2 sm:p-3 cursor-pointer flex-1 flex flex-col justify-between"
                      onClick={() => openProduct(p.id)}
                    >
                      <div>
                        <h3 className="text-xs sm:text-sm font-semibold line-clamp-1 leading-snug text-[var(--fg)]">
                          {p.n}
                        </h3>
                        {p.op && p.op > p.p ? (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-xs sm:text-sm font-black text-[var(--red)] tabular-nums">
                              {formatAr(Math.min(...p.cols.map(col => variantPrice(p.p, col))))}
                            </span>
                            <span className="text-[10px] sm:text-xs text-[var(--mut)] line-through tabular-nums opacity-75">
                              {formatAr(p.op)}
                            </span>
                            <span className="text-[9px] font-bold bg-[var(--red)] text-white px-1 py-0.2 rounded-md">
                              -{Math.round(((p.op - p.p) / p.op) * 100)}%
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs sm:text-sm font-bold text-[var(--red)] tabular-nums mt-0.5">
                            {formatAr(Math.min(...p.cols.map(col => variantPrice(p.p, col))))}
                          </div>
                        )}
                      </div>

                      {/* Color circles & size indicator */}
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-[var(--ln)]/40">
                        <div className="flex items-center gap-1">
                          {p.cols.map((col, idx) => (
                            <span
                              key={idx}
                              title={col.n}
                              className="w-3 h-3 rounded-full border border-black/30 shrink-0 shadow-2xs"
                              style={{ backgroundColor: col.h }}
                            />
                          ))}
                        </div>

                        {p.sz && (
                          <span className="text-[10px] text-[var(--mut)] uppercase font-mono">
                            {p.sz.join('·')}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="col-span-full py-8 text-center text-xs sm:text-sm text-[var(--mut)]">
                Aucun article ne correspond à votre recherche.
              </p>
            )}
          </div>
        </section>

        {/* 4. FAQ SECTION */}
        <ConditionsDeVente />

        <section id="faq" className="wrap py-4 sm:py-6 px-3 sm:px-4">
          <h2 className="text-xl sm:text-2xl font-normal uppercase font-['Anton',sans-serif] tracking-wide border-b-2 border-[var(--red)] pb-0.5 mb-3">
            Questions fréquentes
          </h2>
          <div className="space-y-2 text-xs sm:text-sm">
            <details className="p-3 sm:p-4 bg-[var(--card)] border border-[var(--ln)] rounded-md">
              <summary className="font-semibold cursor-pointer">Livraison</summary>
              <p className="mt-2 text-[var(--mut)]">
                Frais à partir de 3 000 Ar (4 000 Ar en périphérie), livraison uniquement à Antananarivo, sous 7 à 15 jours après validation de ta commande.
              </p>
            </details>
            <details className="p-3 sm:p-4 bg-[var(--card)] border border-[var(--ln)] rounded-md">
              <summary className="font-semibold cursor-pointer">Paiement</summary>
              <p className="mt-2 text-[var(--mut)]">
                Mvola uniquement : soit 50 % d&apos;acompte sur les articles avec le solde payé à la livraison, soit le paiement total des articles à l&apos;avance. Les frais de livraison se payent au livreur le jour J. Le numéro s&apos;affiche à l&apos;étape de commande.
              </p>
            </details>
            <details className="p-3 sm:p-4 bg-[var(--card)] border border-[var(--ln)] rounded-md">
              <summary className="font-semibold cursor-pointer">Confirmation</summary>
              <p className="mt-2 text-[var(--mut)]">
                Ta commande est confirmée sur WhatsApp après vérification du paiement. Le délai de livraison commence à ce moment-là.
              </p>
            </details>
            <details className="p-3 sm:p-4 bg-[var(--card)] border border-[var(--ln)] rounded-md">
              <summary className="font-semibold cursor-pointer">Échanges et retours</summary>
              <p className="mt-2 text-[var(--mut)]">
                Pas d&apos;échange ni de retour possible. Vérifie bien la couleur, la taille et l&apos;adresse avant de valider.
              </p>
            </details>
          </div>
        </section>

        {/* 5. INSTAGRAM LOOKBOOK FEED */}
        <section id="insta" className="wrap py-4 sm:py-6 px-3 sm:px-4">
          <h2 className="text-xl sm:text-2xl font-normal uppercase font-['Anton',sans-serif] tracking-wide border-b-2 border-[var(--red)] pb-0.5 mb-3">
            Suis-nous @hype.mg
          </h2>
          <a
            href="https://instagram.com/hype.mg"
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5 sm:gap-3">
              {rawProducts.slice(0, 4).map((prod) => (
                <div
                  key={prod.id}
                  className="aspect-square bg-white border border-[var(--ln)] rounded-md p-1.5 overflow-hidden flex items-center justify-center group"
                >
                  <img
                    src={prod.colors[0]?.i[0] || HYPE_LOGO}
                    alt={prod.name}
                    className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </a>
        </section>
      </main>

      {/* 6. FOOTER */}
      <footer className="bg-[var(--fg)] text-[var(--bg)] py-6 px-4 text-center mt-6">
        <div className="wrap flex flex-col items-center">
          <img
            src={HYPE_LOGO}
            alt="HYPE"
            className="h-7 w-auto object-contain mb-2 filter brightness-100"
          />
          <p className="text-xs uppercase tracking-wider opacity-80">
            Be hype, Stay ahead
          </p>
          <div className="flex items-center justify-center gap-4 text-xs font-semibold mt-3">
            <a
              href="https://instagram.com/hype.mg"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Instagram
            </a>
            <span>•</span>
            <a
              href="https://wa.me/261381221950"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              WhatsApp
            </a>
            <span>•</span>
            <a href="#cgv" className="hover:underline">
              Conditions de vente
            </a>
            <span>•</span>
            <a
              href="#admin"
              onClick={() => {
                window.location.hash = 'admin';
                setIsAdminRoute(true);
              }}
              className="hover:underline opacity-70"
            >
              Admin
            </a>
          </div>
        </div>
      </footer>

      {/* 7. PRODUCT DETAIL BOTTOM SHEET / MODAL (#m) */}
      {curProd && (() => {
        const c = curProd.cols[ci] || curProd.cols[0] || { n: 'Standard', h: '#0A0A0A', i: [], st: 0 };
        const n = curProd.sz ? (sz ? stk(c, sz) : null) : stk(c);
        const info =
          curProd.sz && !sz
            ? 'Choisis une taille.'
            : n !== null && n <= 0
            ? 'Épuisé.'
            : n !== null && n <= 3
            ? `Dernières pièces : il en reste ${n}.`
            : 'En stock.';
        const badgeStyle = getBadgeStyle(curProd.badge);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setCurProd(null);
            }}
          >
            <div className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto bg-[var(--bg)] rounded-t-xl sm:rounded-md p-4 sm:p-6 relative shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="w-10 h-1 bg-[var(--ln)] rounded-full mx-auto mb-2 sm:hidden" />

              <button
                onClick={() => setCurProd(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[var(--card)] border border-[var(--ln)] flex items-center justify-center text-sm font-bold text-[var(--fg)] active:scale-95 z-10"
                aria-label="Fermer"
              >
                ✕
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                {/* Image Showcase */}
                <div>
                  <div
                    className="relative aspect-square max-h-[36vh] sm:max-h-72 w-full bg-white rounded-md p-3 flex items-center justify-center border border-[var(--ln)] overflow-hidden select-none"
                    style={{ touchAction: 'pan-y' }}
                    onPointerDown={(e) => {
                      pointerStartX.current = e.clientX;
                      touchStartY.current = e.clientY;
                    }}
                    onPointerUp={(e) => {
                      if (pointerStartX.current === null) return;
                      const dx = e.clientX - pointerStartX.current;
                      const dy = e.clientY - (touchStartY.current || 0);
                      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
                        switchSlide(dx < 0 ? 1 : -1);
                      }
                      pointerStartX.current = null;
                      touchStartY.current = null;
                    }}
                    onPointerCancel={() => {
                      pointerStartX.current = null;
                      touchStartY.current = null;
                    }}
                  >
                    <img
                      src={c.i[im] || c.i[0] || HYPE_LOGO}
                      alt={`${curProd.n} ${c.n}`}
                      draggable={false}
                      className="w-full h-full object-contain pointer-events-none"
                    />

                    {curProd.badge && (
                      <span
                        className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${badgeStyle}`}
                      >
                        {curProd.badge}
                      </span>
                    )}

                    {/* Flèches et indicateur de swipe avec la main */}
                    {c.i && c.i.length > 1 && (
                      <>
                        <button
                          onClick={() => switchSlide(-1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-sm active:scale-90 shadow-md"
                          aria-label="Précédent"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() => switchSlide(1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-sm active:scale-90 shadow-md"
                          aria-label="Suivant"
                        >
                          ›
                        </button>

                        {/* Petits points / indicateurs de swipe tactile */}
                        <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-none">
                          {c.i.map((_, dotIdx) => (
                            <span
                              key={dotIdx}
                              className={`h-1.5 rounded-full transition-all ${
                                dotIdx === im
                                  ? 'w-4 bg-red-600 shadow-xs'
                                  : 'w-1.5 bg-black/40'
                              }`}
                            />
                          ))}
                        </div>

                        <span className="absolute top-2 right-2 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs">
                          {im + 1}/{c.i.length}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Thumbnails avec indication de swipe tactile */}
                  {c.i.length > 1 && (
                    <div className="mt-2">
                      <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {c.i.map((s, k) => (
                          <button
                            key={k}
                            onClick={() => setIm(k)}
                            className={`w-11 h-11 bg-white rounded-md p-1 border shrink-0 transition-all ${
                              k === im ? 'border-red-600 ring-2 ring-red-600/40' : 'border-[var(--ln)]'
                            }`}
                          >
                            <img src={s} alt="" className="w-full h-full object-contain" />
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-[var(--mut)] block text-center mt-1">
                        👆 Glisse avec ton doigt pour faire défiler les photos
                      </span>
                    </div>
                  )}
                </div>

                {/* Details & Selectors */}
                <div>
                  <h2 className="text-lg sm:text-xl font-normal uppercase font-['Anton',sans-serif] tracking-wide border-l-3 border-[var(--red)] pl-2">
                    {curProd.n}
                  </h2>
                  
                  {/* Prix normal vs Prix Promotionnel */}
                  {curProd.op && curProd.op > variantPrice(curProd.p, c) ? (
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="text-lg sm:text-xl font-black text-red-600 tabular-nums">
                        {formatAr(variantPrice(curProd.p, c))}
                      </span>
                      <span className="text-xs sm:text-sm text-[var(--mut)] line-through tabular-nums opacity-75">
                        {formatAr(curProd.op)}
                      </span>
                      <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-md">
                        -{Math.round(((curProd.op - variantPrice(curProd.p, c)) / curProd.op) * 100)}% EN PROMO
                      </span>
                    </div>
                  ) : (
                    <div className="text-base sm:text-lg font-bold text-[var(--red)] tabular-nums mt-1">
                      {formatAr(variantPrice(curProd.p, c))}
                    </div>
                  )}
                  <p className="text-xs sm:text-sm text-[var(--mut)] mt-1.5 leading-relaxed">
                    {curProd.d}
                  </p>

                  {/* Colors with Circles and Labels */}
                  <div className="mt-3">
                    <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <span>Couleur :</span>
                      <span className="text-[var(--fg)] font-bold">{c.n}</span>
                      <span
                        className="inline-block w-3.5 h-3.5 rounded-full border border-black/30 shadow-xs"
                        style={{ backgroundColor: c.h }}
                      />
                    </span>
                    <div className="flex gap-2">
                      {curProd.cols.map((col, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCi(idx);
                            setIm(0);
                            if (sz && !stk(col, sz)) setSz(null);
                          }}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black/20 relative active:scale-95 transition-all ${
                            idx === ci ? 'ring-2 ring-[var(--red)] ring-offset-2' : ''
                          }`}
                          style={{ backgroundColor: col.h }}
                          aria-label={col.n}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Sizes (XS, S, M, L, XL, XXL) */}
                  {curProd.sz && (
                    <div className="mt-3">
                      <span className="text-xs font-semibold uppercase tracking-wider block mb-1">
                        Taille disponible
                      </span>
                      <div className="flex gap-1.5 flex-wrap">
                        {curProd.sz.map((sizeOption) => {
                          const available = stk(c, sizeOption) > 0;
                          const selected = sz === sizeOption;
                          return (
                            <button
                              key={sizeOption}
                              disabled={!available}
                              onClick={() => setSz(sizeOption)}
                              className={`min-w-[40px] h-8 sm:h-9 px-2.5 text-xs font-bold rounded-md border transition-colors inline-flex items-center justify-center ${
                                selected
                                  ? 'border-[var(--red)] text-[var(--fg)] ring-1 ring-[var(--red)]'
                                  : available
                                  ? 'border-[var(--fg)] text-[var(--fg)] hover:bg-black/5'
                                  : 'border-[var(--ln)] text-[var(--mut)] opacity-40 line-through'
                              }`}
                            >
                              {selected ? (
                                <span className="size-selected-dot">{sizeOption}</span>
                              ) : (
                                sizeOption
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-[var(--mut)] mt-2 italic">{info}</p>
                </div>
              </div>

              {/* Action Button */}
              <div className="sticky bottom-0 bg-[var(--bg)] pt-3 pb-[env(safe-area-inset-bottom,0px)] mt-4 border-t border-[var(--ln)]">
                <button
                  onClick={addToCart}
                  disabled={(Boolean(curProd.sz) && !sz) || (n !== null && n <= 0)}
                  className="w-full h-12 text-xs sm:text-sm font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 active:scale-[0.98] transition-all shadow-md rounded-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 7h12l1 14H5L6 7z" />
                    <path d="M9 7a3 3 0 0 1 6 0" />
                  </svg>
                  <span>Ajouter au panier</span>
                </button>
                <Button asChild variant="link" className="w-full h-auto py-3 whitespace-normal text-[var(--red)]">
                  <a href={`https://wa.me/${WA}?text=${encodeURIComponent('Bonjour HYPE ! Je souhaite poser une question sur ' + curProd.n + ' (' + c.n + ').')}`} target="_blank" rel="noopener noreferrer">Poser une question sur WhatsApp</a>
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 8. CART & CHECKOUT DRAWER (#d) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex justify-end backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="w-full sm:max-w-md h-full bg-[var(--bg)] p-4 sm:p-6 overflow-y-auto flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--ln)]">
                <h2 className="text-lg sm:text-xl font-normal uppercase font-['Anton',sans-serif] tracking-wide border-l-3 border-[var(--red)] pl-2">
                  {drawerView === 'cart'
                    ? 'Mon panier'
                    : drawerView === 'co'
                    ? 'Ma commande'
                    : 'Commande validée'}
                </h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-[var(--card)] border border-[var(--ln)] flex items-center justify-center text-sm font-bold active:scale-95"
                >
                  ✕
                </button>
              </div>

              {drawerView !== 'ok' && cart.length > 0 && (
                <fieldset className="mt-4 border-0 space-y-2">
                  <legend className="font-semibold text-sm mb-2">Zone de livraison *</legend>
                  {([['ville', 'Antananarivo ville', 3000], ['peripherie', 'Périphérie / Environs', 4000]] as const).map(([zone, label, fee]) => (
                    <label key={zone} className={`flex items-center gap-2 p-3 border rounded-md text-xs cursor-pointer ${coZone === zone ? 'border-[var(--red)] bg-[var(--card)]' : 'border-[var(--ln)]'}`}>
                      <input type="radio" name="delivery-zone" value={zone} checked={coZone === zone} onChange={() => setCoZone(zone)} className="accent-[var(--red)]" />
                      <span className="flex-1">{label}</span><b>{formatAr(fee)}</b>
                    </label>
                  ))}
                  {coZone && <p className="text-xs text-[var(--mut)]">Frais de livraison : {formatAr(shippingFee)} à payer au livreur le jour J de la livraison.</p>}
                </fieldset>
              )}
              {/* Cart View */}
              {drawerView === 'cart' && (
                <div className="mt-4">
                  {cart.length ? (
                    <div className="space-y-3">
                      {cart.map((x, i) => {
                        const info = lookupCartItem(x);
                        if (!info) return null;
                        const { p, c } = info;

                        return (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-2 bg-[var(--card)] border border-[var(--ln)] rounded-md"
                          >
                            <img
                              src={c.i[0] || HYPE_LOGO}
                              alt={p.n}
                              className="w-14 h-14 object-contain bg-white rounded-md p-1 border border-[var(--ln)] shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs sm:text-sm font-semibold truncate text-[var(--fg)]">
                                {p.n}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[11px] text-[var(--mut)]">
                                <span>{c.n}</span>
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full border border-black/30"
                                  style={{ backgroundColor: c.h }}
                                />
                                {x.s && <span>– Taille {x.s}</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={() => updateCartQty(i, -1)}
                                  className="w-6 h-6 border border-[var(--fg)] flex items-center justify-center text-xs font-bold active:scale-90"
                                >
                                  −
                                </button>
                                <span className="text-xs font-bold tabular-nums">
                                  {x.q}
                                </span>
                                <button
                                  onClick={() => updateCartQty(i, 1)}
                                  className="w-6 h-6 border border-[var(--fg)] flex items-center justify-center text-xs font-bold active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs sm:text-sm font-bold text-[var(--red)] tabular-nums">
                                {formatAr(variantPrice(p.p, c) * x.q)}
                              </div>
                              <button
                                onClick={() => updateCartQty(i, -99)}
                                className="text-[10px] text-[var(--red)] underline mt-1 block hover:opacity-80"
                              >
                                Retirer
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Totals */}
                      <div className="pt-3 border-t border-[var(--ln)] space-y-1.5 text-xs sm:text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--mut)]">Sous-total</span>
                          <span className="font-semibold tabular-nums">
                            {formatAr(cartSubtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--mut)]">Livraison (au livreur)</span>
                          <span className="font-semibold tabular-nums">{coZone ? formatAr(shippingFee) : 'À sélectionner'}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t-2 border-[var(--fg)] text-base font-bold">
                          <span>Total</span>
                          <span className="text-[var(--red)] tabular-nums">
                            {formatAr(cartSubtotal + shippingFee)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs sm:text-sm text-[var(--mut)]">
                      Ton panier est vide. Choisis un article dans le drop.
                    </p>
                  )}
                </div>
              )}

              {/* Checkout Form */}
              {drawerView === 'co' && (
                <div className="mt-4 space-y-3 text-xs sm:text-sm">
                  <div>
                    <label className="block font-semibold mb-1">Nom complet</label>
                    <input
                      type="text"
                      value={coName}
                      onChange={(e) => setCoName(e.target.value)}
                      placeholder="Ex: Hery Rakoto"
                      className="w-full h-10 px-3 text-base sm:text-sm border border-[var(--ln)] bg-[var(--card)] rounded-md focus:outline-none focus:border-[var(--red)]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">
                      Numéro WhatsApp (confirmation de commande)
                    </label>
                    <input
                      type="tel"
                      value={coWa}
                      onChange={(e) => setCoWa(e.target.value)}
                      placeholder="038 12 345 67"
                      className="w-full h-10 px-3 text-base sm:text-sm border border-[var(--ln)] bg-[var(--card)] rounded-md focus:outline-none focus:border-[var(--red)]"
                    />
                  </div>

                  <label className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={coWaConfirm}
                      onChange={(e) => setCoWaConfirm(e.target.checked)}
                      className="mt-0.5 accent-[var(--red)]"
                    />
                    <span>Je confirme que ce numéro est actif sur WhatsApp</span>
                  </label>

                  <div>
                    <label className="block font-semibold mb-1">
                      Adresse de livraison (quartier, repère à Antananarivo)
                    </label>
                    <textarea
                      rows={2}
                      value={coAddr}
                      onChange={(e) => setCoAddr(e.target.value)}
                      placeholder="Quartier, rue ou repère connu..."
                      className="w-full p-2.5 text-base sm:text-sm border border-[var(--ln)] bg-[var(--card)] rounded-md focus:outline-none focus:border-[var(--red)]"
                    />
                  </div>

                  {/* Mvola Mode */}
                  <div>
                    <span className="block font-semibold mb-1.5">Paiement par Mvola</span>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 p-2 bg-[var(--card)] border border-[var(--ln)] rounded-md cursor-pointer">
                        <input
                          type="radio"
                          name="pay"
                          checked={coPayMode === '50'}
                          onChange={() => setCoPayMode('50')}
                          className="accent-[var(--red)]"
                        />
                        <span className="text-xs">Acompte de 50 %, solde à la livraison</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-[var(--card)] border border-[var(--ln)] rounded-md cursor-pointer">
                        <input
                          type="radio"
                          name="pay"
                          checked={coPayMode === '100'}
                          onChange={() => setCoPayMode('100')}
                          className="accent-[var(--red)]"
                        />
                        <span className="text-xs">Paiement total par Mvola</span>
                      </label>
                    </div>
                  </div>

                  {coPayMode && (
                    <div className="p-3 bg-[var(--fg)] text-[var(--bg)] text-xs rounded-md">
                      Envoie <b>{formatAr(getPaymentSummary()?.paid || 0)}</b> par Mvola au{' '}
                      <b>038 12 219 50</b> (Ramamonjy Marielle), puis saisis la référence.
                      <div className="mt-1.5 opacity-90">
                        Les frais de livraison s&apos;élèvent à <b>{formatAr(shippingFee)}</b>, à payer au livreur le jour de la livraison.
                        {coPayMode === '50' && (
                          <> Solde articles à régler à la livraison : <b>{formatAr(cartSubtotal - Math.round(cartSubtotal / 2))}</b>.</>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold mb-1">Référence Mvola</label>
                    <input
                      type="text"
                      value={coMvolaRef}
                      onChange={(e) => setCoMvolaRef(e.target.value)}
                      placeholder="Ex: MV12345678"
                      className="w-full h-10 px-3 text-base sm:text-sm border border-[var(--ln)] bg-[var(--card)] rounded-md focus:outline-none focus:border-[var(--red)]"
                    />
                  </div>

                  <div className="p-3 bg-[var(--card)] border border-[var(--ln)] border-l-4 border-l-[var(--red)] rounded-md text-xs space-y-2">
                    <p className="font-bold uppercase tracking-wider text-[11px]">Conditions principales</p>
                    <ul className="space-y-1 text-[var(--mut)] leading-relaxed">
                      <li>• Livraison assurée exclusivement à Antananarivo et ses environs.</li>
                      <li>• Délai de livraison : 7 à 15 jours à compter de la confirmation de commande.</li>
                      <li>• Votre commande est validée dès réception de votre paiement Mvola ; nous vous recontactons ensuite sur WhatsApp.</li>
                      <li>• Articles neufs : aucun échange ni retour possible.</li>
                    </ul>
                    <a href="#cgv" onClick={() => setDrawerOpen(false)} className="inline-block text-[var(--red)] font-semibold underline">
                      Lire les conditions générales de vente
                    </a>
                    <label className="flex items-start gap-2 pt-2 border-t border-[var(--ln)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={coTerms}
                        onChange={(e) => setCoTerms(e.target.checked)}
                        className="mt-0.5 accent-[var(--red)]"
                      />
                      <span className="font-semibold text-[var(--fg)]">
                        J&apos;ai lu et j&apos;accepte l&apos;ensemble des conditions de vente.
                      </span>
                    </label>
                  </div>

                  {coErrors.length > 0 && (
                    <div className="p-2 bg-red-100 dark:bg-red-950/40 text-[var(--red)] text-xs rounded-md space-y-0.5">
                      {coErrors.map((err, idx) => (
                        <div key={idx}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Order Placed Success */}
              {drawerView === 'ok' && (
                <div className="mt-6 text-center text-xs sm:text-sm space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold">
                    ✓
                  </div>
                  <h3 className="text-base sm:text-lg font-bold">
                    Commande n° {lastOrder.no} enregistrée !
                  </h3>
                  <p className="text-[var(--mut)]">
                    Nous vérifions ton paiement Mvola. Pour accélérer la validation, écris-nous directement sur WhatsApp.
                  </p>
                  <a
                    href={lastOrder.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full h-11 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-md active:scale-98"
                  >
                    Ouvrir WhatsApp
                  </a>
                  <Button variant="outline" className="w-full" onClick={() => { setDrawerOpen(false); setDrawerView('cart'); }}>Continuer mes achats</Button>
                </div>
              )}
            </div>

            {/* Bottom Button in Drawer */}
            <div className="pt-4 border-t border-[var(--ln)] mt-4">
              {drawerView === 'cart' && coErrors.length > 0 && <p role="alert" className="text-[var(--red)] text-xs mb-2">{coErrors.join(' ')}</p>}
              {drawerView === 'cart' && cart.length > 0 && (
                <button
                  onClick={() => { if (!coZone) { setCoErrors(['Choisis ta zone de livraison.']); return; } setDrawerView('co'); }}
                  className="w-full h-11 sm:h-12 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-[var(--red)] hover:opacity-90 active:scale-[0.99]"
                >
                  Passer la commande
                </button>
              )}
              {drawerView === 'co' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setDrawerView('cart')}
                    className="w-1/3 h-11 sm:h-12 text-xs sm:text-sm font-bold uppercase border border-[var(--fg)] active:scale-95"
                  >
                    Retour
                  </button>
                  <button
                    onClick={handleSendOrder}
                    disabled={coSubmitting}
                    className="w-2/3 h-11 sm:h-12 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-[var(--red)] hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
                  >
                    {coSubmitting ? 'Validation...' : 'Envoyer ma commande'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. ADMIN INTERFACE (#admin) */}
      {isAdminRoute && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)] text-[var(--fg)] p-3 sm:p-6">
          <div className="wrap max-w-3xl mx-auto">
            {/* Admin Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ln)] mb-4">
              <div className="flex items-center gap-2">
                <img src={HYPE_LOGO} alt="HYPE" className="h-6 w-auto object-contain" />
                <span className="font-['Anton',sans-serif] text-base sm:text-lg uppercase tracking-wide">
                  Admin HYPE
                </span>
              </div>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = '';
                  setIsAdminRoute(false);
                }}
                className="text-xs font-semibold text-[var(--mut)] hover:underline"
              >
                ← Retour au site
              </a>
            </div>

            {!isAdmin || admMode !== 'dashboard' ? (
              <div className="max-w-md mx-auto bg-[var(--card)] border border-[var(--ln)] p-4 sm:p-6 rounded-md shadow-md">
                {/* LOGIN FORM */}
                {admMode === 'login' && (
                  <form onSubmit={handleAdminLogin} className="space-y-3 text-xs sm:text-sm">
                    <h3 className="text-base sm:text-lg font-bold uppercase font-['Anton',sans-serif] tracking-wide border-l-3 border-[var(--red)] pl-2">
                      Connexion sécurisée
                    </h3>

                    <div>
                      <label className="block font-semibold mb-1">E-mail</label>
                      <input
                        type="email"
                        required
                        value={admEmail}
                        onChange={(e) => setAdmEmail(e.target.value)}
                        className="w-full h-10 px-3 text-base sm:text-sm border border-[var(--ln)] bg-[var(--bg)] rounded-md focus:outline-none focus:border-[var(--red)]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">Mot de passe</label>
                      <input
                        type="password"
                        required
                        placeholder="Saisis ton mot de passe"
                        value={admPass}
                        onChange={(e) => setAdmPass(e.target.value)}
                        className="w-full h-10 px-3 text-base sm:text-sm border border-[var(--ln)] bg-[var(--bg)] rounded-md focus:outline-none focus:border-[var(--red)]"
                      />
                    </div>

                    {admMsg && (
                      <div className="p-2 bg-red-100 dark:bg-red-950/40 text-[var(--red)] text-xs rounded-md">
                        {admMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={admBusy}
                      className="w-full h-11 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-[var(--red)] hover:opacity-90 active:scale-98 disabled:opacity-50"
                    >
                      {admBusy ? 'Vérification...' : 'Se connecter'}
                    </button>

                    <Button type="button" variant="outline" disabled={admBusy} onClick={handleCreateAdminAccount} className="w-full whitespace-normal h-auto min-h-10">
                      Premier accès : créer mon compte admin
                    </Button>
                    <div className="pt-2 flex justify-between text-xs text-[var(--mut)]">
                      <button
                        type="button"
                        onClick={() => {
                          setAdmMsg('');
                          setAdmMode('forgot');
                        }}
                        className="hover:underline"
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>

                    <div className="p-2.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-md text-[11px] text-[var(--mut)] leading-relaxed mt-2 border border-[var(--ln)]">
                      <b>Accès protégé :</b> seuls votre mot de passe ou le lien/code reçu sur votre e-mail administrateur permettent de vous connecter.
                    </div>
                  </form>
                )}

                {/* WRONG PASSWORD -> 6-DIGIT EMAIL CODE CHALLENGE */}
                {admMode === 'verify-code' && challenge && (
                  <form onSubmit={handleVerifyCodeSubmit} className="space-y-3 text-xs sm:text-sm">
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 rounded-md text-xs text-amber-900 dark:text-amber-200">
                      <b className="block font-bold">Tentative protégée :</b>
                      {challenge.message}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--mut)]">
                      <span>Destinataire : <b>{challenge.email}</b></span>

                    </div>

                    <div>
                      <label className="block font-semibold mb-1">
                        Code de vérification e-mail
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        autoFocus
                        required
                        placeholder="000000"
                        value={verificationCodeInput}
                        onChange={(e) =>
                          setVerificationCodeInput(e.target.value.replace(/\D/g, '').slice(0, 8))
                        }
                        className="w-full h-12 text-center font-mono text-2xl tracking-[0.25em] font-bold border-2 border-[var(--red)] bg-[var(--bg)] rounded-md focus:outline-none"
                      />
                    </div>


                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={wantUpdatePassAfterCode}
                        onChange={(e) => setWantUpdatePassAfterCode(e.target.checked)}
                        className="accent-[var(--red)]"
                      />
                      <span>Mettre à jour le mot de passe après cette validation</span>
                    </label>

                    {wantUpdatePassAfterCode && (
                      <input
                        type="password"
                        placeholder="Nouveau mot de passe (min 8 car.)"
                        value={newPassAfterCode}
                        onChange={(e) => setNewPassAfterCode(e.target.value)}
                        className="w-full h-10 px-3 text-base sm:text-sm border border-[var(--ln)] bg-[var(--bg)] rounded-md focus:outline-none"
                      />
                    )}

                    {admMsg && (
                      <div className="p-2 bg-red-100 dark:bg-red-950/40 text-[var(--red)] text-xs rounded-md">
                        {admMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={admBusy}
                      className="w-full h-11 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-[var(--red)] hover:opacity-90 active:scale-98 disabled:opacity-50"
                    >
                      Valider et ouvrir la session
                    </button>

                    <div className="flex justify-between pt-1 text-xs">
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={admBusy}
                        className="text-[var(--mut)] hover:underline"
                      >
                        Renvoyer un code
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdmMsg('');
                          setChallenge(null);
                          setAdmMode('login');
                        }}
                        className="text-[var(--mut)] hover:underline"
                      >
                        ← Annuler
                      </button>
                    </div>
                  </form>
                )}

                {/* FORGOT PASSWORD */}
                {admMode === 'forgot' && (
                  <form onSubmit={handleSendRecovery} className="space-y-3 text-xs sm:text-sm">
                    <h3 className="text-base sm:text-lg font-bold uppercase font-['Anton',sans-serif] tracking-wide border-l-3 border-[var(--red)] pl-2">
                      Code de réinitialisation
                    </h3>
                    <p className="text-xs text-[var(--mut)]">
                      Recevez un e-mail de connexion sécurisé sur votre adresse administrateur.
                    </p>
                    <input
                      type="email"
                      required
                      value={admEmail}
                      onChange={(e) => setAdmEmail(e.target.value)}
                      className="w-full h-10 px-3 text-base sm:text-sm border border-[var(--ln)] bg-[var(--bg)] rounded-md focus:outline-none"
                    />
                    {admMsg && (
                      <div className="p-2 bg-red-100 dark:bg-red-950/40 text-[var(--red)] text-xs rounded-md">
                        {admMsg}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={admBusy}
                      className="w-full h-11 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-[var(--red)] hover:opacity-90"
                    >
                      Envoyer le code
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdmMode('login')}
                      className="text-xs text-[var(--mut)] hover:underline block mx-auto pt-1"
                    >
                      ← Retour à la connexion
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* DASHBOARD VIEW */
              <div className="space-y-4">
                {/* Scrollable Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <button
                    onClick={() => {
                      setAdmTab('o');
                      setAdmEditingProd(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap rounded-md border ${
                      admTab === 'o'
                        ? 'bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]'
                        : 'border-[var(--fg)]'
                    }`}
                  >
                    Commandes ({orders.length})
                  </button>
                  <button
                    onClick={() => {
                      setAdmTab('p');
                      setAdmEditingProd(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap rounded-md border ${
                      admTab === 'p'
                        ? 'bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]'
                        : 'border-[var(--fg)]'
                    }`}
                  >
                    Catalogue & Produits ({rawProducts.length})
                  </button>
                  <button
                    onClick={() => {
                      setAdmTab('s');
                      setAdmEditingProd(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap rounded-md border ${
                      admTab === 's'
                        ? 'bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]'
                        : 'border-[var(--fg)]'
                    }`}
                  >
                    Sécurité e-mail ({securityLogs.length})
                  </button>
                  <a
                    href="/hype-site-complet.zip"
                    download="hype-site-complet.zip"
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap rounded-md bg-[var(--fg)] text-[var(--bg)] flex items-center gap-1.5 active:scale-95 transition-all shadow-xs ml-auto"
                    title="Télécharger l'intégralité du site en fichier ZIP"
                  >
                    <span>📦</span>
                    <span>Télécharger ZIP</span>
                  </a>
                  <button
                    onClick={handleAdminLogout}
                    className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap rounded-md border border-red-600 text-red-600"
                  >
                    Déconnexion
                  </button>
                </div>

                {admVerifyBanner && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs rounded-md border border-emerald-300">
                    {admVerifyBanner}
                  </div>
                )}

                {/* 1. ORDERS TAB - COLOR-CODED AS REQUESTED BY USER */}
                {admTab === 'o' && (
                  <div className="space-y-3">
                    {/* Visual Status Legend */}
                    <div className="p-3 bg-[var(--card)] border border-[var(--ln)] rounded-md text-xs space-y-2">
                      <div className="font-bold uppercase tracking-wider text-[11px] text-[var(--mut)]">
                        Légende visuelle des statuts de commande :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                        <span className="p-1.5 rounded-md bg-red-500/20 text-red-800 dark:text-red-300 border border-red-500 font-bold text-center">
                          🔴 En attente (Rouge)
                        </span>
                        <span className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500 font-bold text-center">
                          🟢 Vérifié (Vert)
                        </span>
                        <span className="p-1.5 rounded-md bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-500 font-bold text-center">
                          🔵 En livraison (Bleu)
                        </span>
                        <span className="p-1.5 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-400 font-bold text-center">
                          ⚪ Livrée (Blanc)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        onClick={exportCsv}
                        className="px-3 py-1 text-xs font-bold uppercase border border-[var(--fg)] rounded-md hover:bg-black/5"
                      >
                        Exporter CSV
                      </button>
                      <button
                        onClick={() => setAdmShowCancelled(!admShowCancelled)}
                        className="text-xs text-[var(--mut)] underline"
                      >
                        {admShowCancelled ? 'Masquer' : 'Voir'} annulées (
                        {orders.filter((o) => o.status === 'Annulée').length})
                      </button>
                    </div>

                    <div className="space-y-3">
                      {orders
                        .filter((o) => admShowCancelled || o.status !== 'Annulée')
                        .map((o) => {
                          const statusConf = getOrderStatusConfig(o.status);
                          const whatsappUrl = `https://wa.me/261${o.whatsapp.slice(
                            1
                          )}?text=${encodeURIComponent(
                            "Bonjour, c'est HYPE ! Nous avons bien reçu ta commande n°" + o.no
                          )}`;

                          return (
                            <div
                              key={o.id}
                              className={`p-3.5 sm:p-4 rounded-md text-xs space-y-2 transition-all ${statusConf.cardClass}`}
                            >
                              {/* Header row with Status Badge */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold font-mono text-sm">{o.no}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${statusConf.badgeClass}`}
                                  >
                                    {o.status}
                                  </span>
                                </div>
                                <span className="text-[11px] opacity-75">
                                  {new Date(o.created_at).toLocaleString('fr-FR')}
                                </span>
                              </div>

                              {/* Customer info */}
                              <div>
                                <span className="font-bold text-sm block">{o.name}</span>
                                <span className="text-[12px] opacity-90">{o.whatsapp}</span>
                                <p className="opacity-80 mt-0.5">{o.address}</p>
                                {o.notes && (
                                  <p className="italic opacity-70 mt-0.5">Note: {o.notes}</p>
                                )}
                              </div>

                              {/* Items with COLOR CIRCLES and SIZES */}
                              <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-md space-y-1.5 border border-black/10 dark:border-white/10">
                                <span className="font-bold text-[11px] uppercase tracking-wider opacity-75 block">
                                  Articles commandés :
                                </span>
                                {o.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-2 text-[12px]"
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold">{item.q} ×</span>
                                      <span className="font-medium">{item.name}</span>
                                      <span className="flex items-center gap-1 bg-white/70 dark:bg-black/40 px-1.5 py-0.5 rounded-md border border-black/10">
                                        {/* Color circle */}
                                        <span
                                          className="inline-block w-3 h-3 rounded-full border border-black/30 shadow-2xs shrink-0"
                                          style={{
                                            backgroundColor: item.colorHex || '#111111',
                                          }}
                                        />
                                        <span className="text-[11px] font-semibold">
                                          {item.color}
                                        </span>
                                      </span>
                                      {item.size && (
                                        <span className="bg-white/70 dark:bg-black/40 px-1.5 py-0.5 rounded-md border border-black/10 text-[11px] font-bold">
                                          Taille : {item.size}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-bold tabular-nums shrink-0">
                                      {formatAr(item.price * item.q)}
                                    </span>
                                  </div>
                                ))}

                                <div className="flex items-center justify-between pt-1.5 border-t border-black/10 dark:border-white/10 font-bold text-[12px]">
                                  <span>
                                    Mode: {o.pay_mode === '50' ? 'Acompte 50%' : '100% Mvola'}
                                  </span>
                                  <span>
                                    Payé: {formatAr(o.paid)}{' '}
                                    {o.balance > 0 && `(Solde: ${formatAr(o.balance)})`}
                                  </span>
                                </div>
                                <div className="text-[11px] opacity-80">
                                  Réf. Mvola : <b className="font-mono">{o.mvola_ref}</b>
                                </div>
                              </div>

                              {/* Status Select & WhatsApp Action */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] font-semibold">Changer le statut :</span>
                                  <select
                                    value={o.status}
                                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                                    className="h-8 px-2 text-xs font-semibold border border-black/30 dark:border-white/30 bg-white dark:bg-neutral-800 rounded-md shadow-xs"
                                  >
                                    {ST.map((s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md text-[11px] flex items-center gap-1 active:scale-95 shadow-xs"
                                >
                                  <span>💬</span>
                                  <span>WhatsApp</span>
                                </a>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 2. PRODUCTS TAB - FULL FORM WITH GALLERY PHOTO UPLOADER, COLOR CIRCLES, SIZES & BADGES */}
                {admTab === 'p' && !admEditingProd && (
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setAdmProdError('');
                        setCustomBadgeInput('');
                        setAdmEditingProd({
                          name: '',
                          category: 'Hoodies',
                          price: 65000,
                          descr: '',
                          badge: 'DROP',
                          visible: true,
                          sizes: ['S', 'M', 'L', 'XL'],
                          colors: [
                            {
                              n: 'Noir',
                              h: '#0A0A0A',
                              i: [],
                              st: { S: 3, M: 5, L: 4, XL: 2 },
                            },
                          ],
                        });
                      }}
                      className="w-full h-11 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-[var(--red)] hover:opacity-90 rounded-md flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span>+</span>
                      <span>Ajouter un article au catalogue</span>
                    </button>

                    <div className="space-y-2">
                      {rawProducts.map((p) => {
                        const totalStock = p.colors.reduce((a, c) => a + totalColorStock(c), 0);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-3 bg-[var(--card)] border border-[var(--ln)] rounded-md text-xs gap-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={p.colors[0]?.i[0] || HYPE_LOGO}
                                alt={p.name}
                                className="w-12 h-12 object-contain bg-white rounded-md p-1 border border-[var(--ln)] shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-semibold text-sm text-[var(--fg)] truncate">
                                    {p.name}
                                  </h4>
                                  {p.badge && (
                                    <span
                                      className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-md ${getBadgeStyle(
                                        p.badge
                                      )}`}
                                    >
                                      {p.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[var(--mut)] flex items-center gap-2 mt-0.5">
                                  <span>{p.category}</span>
                                  <span>•</span>
                                  <span className="font-bold text-[var(--red)]">
                                    {formatAr(p.price)}
                                  </span>
                                  <span>•</span>
                                  <span>Stock: {totalStock}</span>
                                </div>
                                {/* Colors circles list */}
                                <div className="flex items-center gap-1 mt-1">
                                  {p.colors.map((c, k) => (
                                    <span
                                      key={k}
                                      title={c.n}
                                      className="w-2.5 h-2.5 rounded-full border border-black/30 shrink-0"
                                      style={{ backgroundColor: c.h }}
                                    />
                                  ))}
                                  {p.sizes && p.sizes.length > 0 && (
                                    <span className="text-[10px] text-[var(--mut)] ml-1">
                                      Tailles: {p.sizes.join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => {
                                  setAdmProdError('');
                                  setCustomBadgeInput(
                                    PRESET_BADGES.some((b) => b.val === p.badge)
                                      ? ''
                                      : p.badge || ''
                                  );
                                  setAdmEditingProd(JSON.parse(JSON.stringify(p)));
                                }}
                                className="px-2.5 py-1.5 border border-[var(--fg)] text-xs font-semibold rounded-md hover:bg-black/5"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="px-2.5 py-1.5 border border-red-600 text-red-600 text-xs font-semibold rounded-md hover:bg-red-50"
                              >
                                Suppr.
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. PRODUCT EDIT / CREATION COMPREHENSIVE FORM */}
                {admTab === 'p' && admEditingProd && (
                  <div className="bg-[var(--card)] border border-[var(--ln)] p-4 sm:p-5 rounded-md space-y-4 text-xs sm:text-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--ln)]">
                      <h3 className="font-bold text-base font-['Anton',sans-serif] uppercase tracking-wide">
                        {admEditingProd.id ? 'Modifier l’article' : 'Ajouter un nouvel article'}
                      </h3>
                      <button
                        onClick={() => setAdmEditingProd(null)}
                        className="text-xs text-[var(--mut)] hover:underline"
                      >
                        ✕ Annuler
                      </button>
                    </div>

                    {/* Section 1: Informations générales */}
                    <div className="space-y-3">
                      <div>
                        <label className="block font-semibold mb-1">
                          Nom du modèle *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Hoodie Oversize HYPE 'Black Blood'"
                          value={admEditingProd.name || ''}
                          onChange={(e) =>
                            setAdmEditingProd({ ...admEditingProd, name: e.target.value })
                          }
                          className="w-full h-10 px-3 border border-[var(--ln)] bg-[var(--bg)] rounded-md focus:outline-none focus:border-[var(--red)]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1">
                            Catégorie *
                          </label>
                          <input
                            type="text"
                            list="cat-suggestions"
                            value={admEditingProd.category || ''}
                            onChange={(e) =>
                              setAdmEditingProd({
                                ...admEditingProd,
                                category: e.target.value,
                              })
                            }
                            placeholder="Hoodies, T-shirts, Sacs, Casquettes..."
                            className="w-full h-10 px-3 border border-[var(--ln)] bg-[var(--bg)] rounded-md focus:outline-none focus:border-[var(--red)]"
                          />
                          <datalist id="cat-suggestions">
                            <option value="Hoodies" />
                            <option value="T-shirts" />
                            <option value="Sacs" />
                            <option value="Casquettes" />
                            <option value="Sneakers" />
                            <option value="Pantalons" />
                            <option value="Accessoires" />
                          </datalist>
                        </div>

                        <div>
                          <label className="block font-semibold mb-1">
                            Prix de vente effectif (Ar) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={admEditingProd.price || 0}
                            onChange={(e) =>
                              setAdmEditingProd({
                                ...admEditingProd,
                                price: Number(e.target.value),
                              })
                            }
                            className="w-full h-10 px-3 border border-[var(--ln)] bg-[var(--bg)] rounded-md focus:outline-none focus:border-[var(--red)] font-bold text-[var(--red)]"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1">
                            Prix de base normal (barré si promotion, en Ar)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="Ex: 75 000 (optionnel)"
                            value={admEditingProd.original_price || ''}
                            onChange={(e) =>
                              setAdmEditingProd({
                                ...admEditingProd,
                                original_price: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className="w-full h-10 px-3 border border-[var(--ln)] bg-[var(--bg)] rounded-md focus:outline-none focus:border-[var(--red)] font-medium text-[var(--fg)]"
                          />
                          {Boolean(
                            admEditingProd.original_price &&
                            admEditingProd.price &&
                            admEditingProd.original_price > admEditingProd.price
                          ) && (
                            <span className="text-[11px] font-bold text-red-600 block mt-1">
                              ✓ Réduction calculée : -{Math.round(
                                ((admEditingProd.original_price! - admEditingProd.price!) /
                                  admEditingProd.original_price!) *
                                  100
                              )}% affichée sur le site
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Description</label>
                        <textarea
                          rows={2}
                          placeholder="Matière, grammage, coupe, finitions..."
                          value={admEditingProd.descr || ''}
                          onChange={(e) =>
                            setAdmEditingProd({ ...admEditingProd, descr: e.target.value })
                          }
                          className="w-full p-2.5 border border-[var(--ln)] bg-[var(--bg)] rounded-md focus:outline-none focus:border-[var(--red)]"
                        />
                      </div>

                      {/* ÉTIQUETTE / BADGE DÉCIDÉ PAR L'ADMIN */}
                      <div className="p-3 bg-[var(--bg)] border border-[var(--ln)] rounded-md space-y-2">
                        <label className="block font-semibold text-xs">
                          🏷️ Étiquette sur l&apos;article (présent uniquement quand vous le décidez) :
                        </label>
                        <select
                          value={
                            PRESET_BADGES.some((b) => b.val === admEditingProd.badge)
                              ? admEditingProd.badge
                              : admEditingProd.badge
                              ? 'CUSTOM'
                              : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'CUSTOM') {
                              setAdmEditingProd({
                                ...admEditingProd,
                                badge: customBadgeInput || 'ÉDITION LIMITÉE',
                              });
                            } else {
                              setAdmEditingProd({
                                ...admEditingProd,
                                badge: val,
                              });
                              setCustomBadgeInput('');
                            }
                          }}
                          className="w-full h-10 px-3 border border-[var(--ln)] bg-[var(--card)] rounded-md font-semibold"
                        >
                          {PRESET_BADGES.map((b) => (
                            <option key={b.val} value={b.val}>
                              {b.label}
                            </option>
                          ))}
                          <option value="CUSTOM">Autre texte personnalisé...</option>
                        </select>

                        {(!PRESET_BADGES.some((b) => b.val === admEditingProd.badge) ||
                          customBadgeInput) && (
                          <input
                            type="text"
                            placeholder="Saisissez l'étiquette personnalisée (ex: NOUVEAUTÉ)"
                            value={admEditingProd.badge || customBadgeInput}
                            onChange={(e) => {
                              setCustomBadgeInput(e.target.value);
                              setAdmEditingProd({
                                ...admEditingProd,
                                badge: e.target.value,
                              });
                            }}
                            className="w-full h-9 px-3 border border-[var(--ln)] bg-[var(--card)] rounded-md"
                          />
                        )}
                        <p className="text-[11px] text-[var(--mut)]">
                          Si &quot;Aucune étiquette&quot; est sélectionné, aucun badge n&apos;apparaîtra sur l&apos;article.
                        </p>
                      </div>

                      {/* SECTION TAILLES (XS, S, M, L, XL, XXL) */}
                      <div className="p-3 bg-[var(--bg)] border border-[var(--ln)] rounded-md space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-xs">
                            📏 Tailles disponibles pour ce modèle :
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const hasSizes = (admEditingProd.sizes || []).length > 0;
                              setAdmEditingProd({
                                ...admEditingProd,
                                sizes: hasSizes ? [] : ['S', 'M', 'L', 'XL'],
                              });
                            }}
                            className="text-[11px] text-[var(--red)] underline font-bold"
                          >
                            {(admEditingProd.sizes || []).length > 0
                              ? 'Passer en Taille Unique (Sacs, Casquettes...)'
                              : 'Activer les tailles de vêtements'}
                          </button>
                        </div>

                        {(admEditingProd.sizes || []).length > 0 ? (
                          <div>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {PRESET_SIZES.map((szPreset) => {
                                const active = (admEditingProd.sizes || []).includes(szPreset);
                                return (
                                  <button
                                    key={szPreset}
                                    type="button"
                                    onClick={() => {
                                      const current = admEditingProd.sizes || [];
                                      const nextSizes = active
                                        ? current.filter((s) => s !== szPreset)
                                        : [...current, szPreset];
                                      setAdmEditingProd({
                                        ...admEditingProd,
                                        sizes: nextSizes,
                                      });
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md border transition-all ${
                                      active
                                        ? 'bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)] shadow-xs'
                                        : 'bg-[var(--card)] text-[var(--mut)] border-[var(--ln)] opacity-50'
                                    }`}
                                  >
                                    {szPreset} {active ? '✓' : ''}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[11px] text-[var(--mut)] mt-1.5">
                              Cliquez sur les tailles que vous proposez. Le stock pourra être ajusté pour chaque taille ci-dessous.
                            </p>
                          </div>
                        ) : (
                          <div className="text-[11px] text-[var(--mut)] bg-[var(--card)] p-2 rounded-md">
                            ✓ Taille unique (idéal pour accessoires, sacs, casquettes).
                          </div>
                        )}
                      </div>

                      {/* SECTION COULEURS AVEC CERCLES PASTILLES, PHOTOS DE GALERIE & STOCKS */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-sm uppercase tracking-wide border-l-2 border-[var(--red)] pl-2">
                            🎨 Couleurs, Cercles & Photos galerie
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newColor: ProductColor = {
                                n: 'Nouvelle Couleur',
                                h: '#0A0A0A',
                                i: [],
                                st: (admEditingProd.sizes || []).length
                                  ? Object.fromEntries(
                                      (admEditingProd.sizes || []).map((s) => [s, 3])
                                    )
                                  : 5,
                              };
                              setAdmEditingProd({
                                ...admEditingProd,
                                colors: [...(admEditingProd.colors || []), newColor],
                              });
                            }}
                            className="px-3 py-1 bg-[var(--fg)] text-[var(--bg)] text-xs font-bold uppercase rounded-md"
                          >
                            + Ajouter une couleur
                          </button>
                        </div>

                        {/* List of Colors */}
                        <div className="space-y-3">
                          {(admEditingProd.colors || []).map((col, colIdx) => (
                            <div
                              key={colIdx}
                              className="p-3.5 bg-[var(--bg)] border-2 border-[var(--ln)] rounded-md space-y-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs uppercase tracking-wider">
                                  Couleur #{colIdx + 1}
                                </span>
                                {(admEditingProd.colors || []).length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextCols = [...(admEditingProd.colors || [])];
                                      nextCols.splice(colIdx, 1);
                                      setAdmEditingProd({
                                        ...admEditingProd,
                                        colors: nextCols,
                                      });
                                    }}
                                    className="text-xs text-red-600 font-bold hover:underline"
                                  >
                                    Supprimer cette couleur
                                  </button>
                                )}
                              </div>

                              {/* Color Name & Hex Picker with Live Visual Circle */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                <div>
                                  <label className="block text-[11px] font-semibold mb-1">
                                    Nom de la couleur (ex: Noir, Blanc, Kaki...) *
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={col.n}
                                    onChange={(e) => {
                                      const nextCols = [...(admEditingProd.colors || [])];
                                      nextCols[colIdx].n = e.target.value;
                                      setAdmEditingProd({
                                        ...admEditingProd,
                                        colors: nextCols,
                                      });
                                    }}
                                    className="w-full h-9 px-3 border border-[var(--ln)] bg-[var(--card)] rounded-md"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-semibold mb-1">
                                    Cercle de couleur (Pastille visuelle) *
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={col.h || '#0A0A0A'}
                                      onChange={(e) => {
                                        const nextCols = [...(admEditingProd.colors || [])];
                                        nextCols[colIdx].h = e.target.value;
                                        setAdmEditingProd({
                                          ...admEditingProd,
                                          colors: nextCols,
                                        });
                                      }}
                                      className="w-10 h-10 p-0 border border-[var(--ln)] rounded-md cursor-pointer"
                                    />
                                    {/* Visual preview circle */}
                                    <span
                                      className="w-8 h-8 rounded-full border-2 border-black/40 shadow-xs inline-block"
                                      style={{ backgroundColor: col.h }}
                                    />
                                    <span className="font-mono text-xs uppercase">{col.h}</span>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label htmlFor={`price-${colIdx}`} className="block text-[11px] font-semibold mb-1">Prix spécifique par couleur / modèle (Ar)</label>
                                <input id={`price-${colIdx}`} type="number" min="1" step="1" placeholder={`Prix de base : ${admEditingProd.price || 0} Ar`} value={col.p ?? ''} onChange={e => {
                                  const colors = (admEditingProd.colors || []).map((color, index) => index === colIdx ? { ...color, p: e.target.value === '' ? undefined : Number(e.target.value) } : color);
                                  setAdmEditingProd({ ...admEditingProd, colors });
                                }} className="w-full h-9 px-3 border border-[var(--ln)] bg-[var(--card)] rounded-md" />
                              </div>
                              {/* PHOTO UPLOADER FROM GALLERY WITH PROFESSIONAL STUDIO PROCESSING */}
                              <div className="p-3 bg-[var(--card)] border border-[var(--ln)] rounded-md space-y-2.5">
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                  <label className="block font-bold text-xs uppercase tracking-wide">
                                    📸 Photos de cette couleur (Galerie)
                                  </label>
                                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-300">
                                    ✓ Redimensionnement 1:1 SANS DÉFORMATION
                                  </span>
                                </div>

                                <fieldset className="flex flex-wrap gap-3 text-xs">
                                  <legend className="font-semibold mb-2">Cadrage photo</legend>
                                  {([['cover', 'Plein format 1:1 net'], ['blur', 'Flou d’arrière-plan esthétique']] as const).map(([mode, label]) => (
                                    <label key={mode} className="flex gap-2 items-center cursor-pointer">
                                      <input type="radio" name={`framing-${colIdx}`} checked={studioMode === mode} onChange={() => { setStudioMode(mode); setStudioRemoveBg(false); }} className="accent-[var(--red)]" />{label}
                                    </label>
                                  ))}
                                </fieldset>
                                {/* Studio Photo Controls : Fond Blanc, Fond Noir, Détourage automatique */}
                                <div className="p-2.5 bg-[var(--bg)] border border-[var(--ln)] rounded-md space-y-2">
                                  <div className="flex items-center justify-between text-[11px] font-semibold">
                                    <span>🎨 Studio Photo & Détourage automatique :</span>
                                    <label className="flex items-center gap-1 cursor-pointer text-[var(--red)]">
                                      <input
                                        type="checkbox"
                                        checked={studioRemoveBg}
                                        onChange={(e) => setStudioRemoveBg(e.target.checked)}
                                        className="accent-red-600 cursor-pointer"
                                      />
                                      <span>Enlever l&apos;arrière-plan</span>
                                    </label>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStudioMode('white');
                                        setStudioRemoveBg(true);
                                      }}
                                      className={`p-1.5 rounded-md border font-bold text-center transition-all ${
                                        studioMode === 'white' && studioRemoveBg
                                          ? 'border-red-600 bg-white text-black shadow-xs ring-1 ring-red-600'
                                          : 'border-[var(--ln)] opacity-70 hover:opacity-100'
                                      }`}
                                    >
                                      ⚪ Fond Blanc
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStudioMode('dark');
                                        setStudioRemoveBg(true);
                                      }}
                                      className={`p-1.5 rounded-md border font-bold text-center transition-all ${
                                        studioMode === 'dark' && studioRemoveBg
                                          ? 'border-red-600 bg-neutral-900 text-white shadow-xs ring-1 ring-red-600'
                                          : 'border-[var(--ln)] opacity-70 hover:opacity-100'
                                      }`}
                                    >
                                      ⚫ Fond Noir
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStudioMode('transparent');
                                        setStudioRemoveBg(true);
                                      }}
                                      className={`p-1.5 rounded-md border font-bold text-center transition-all ${
                                        studioMode === 'transparent' && studioRemoveBg
                                          ? 'border-red-600 bg-neutral-200 text-neutral-900 shadow-xs ring-1 ring-red-600'
                                          : 'border-[var(--ln)] opacity-70 hover:opacity-100'
                                      }`}
                                    >
                                      🏁 Transparent
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStudioMode('cover');
                                        setStudioRemoveBg(false);
                                      }}
                                      className={`p-1.5 rounded-md border font-bold text-center transition-all ${
                                        studioMode === 'cover'
                                          ? 'border-red-600 bg-black/5 text-[var(--fg)] shadow-xs ring-1 ring-red-600'
                                          : 'border-[var(--ln)] opacity-70 hover:opacity-100'
                                      }`}
                                    >
                                      📷 Plein format
                                    </button>
                                  </div>
                                </div>

                                {/* Upload button */}
                                <label className="flex items-center justify-center gap-2 w-full h-11 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-md cursor-pointer active:scale-98 transition-all shadow-sm">
                                  {studioProcessing ? (
                                    <>
                                      <span className="animate-spin">⏳</span>
                                      <span>Traitement studio pro en cours...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>📷 Choisir des photos dans ma galerie</span>
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    disabled={studioProcessing}
                                    className="hidden"
                                    onChange={(e) =>
                                      handleUploadGalleryPhotos(colIdx, e.target.files)
                                    }
                                  />
                                </label>

                                {/* Thumbnails Gallery Preview */}
                                {col.i && col.i.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {col.i.map((photoUrl, pIdx) => (
                                        <div
                                          key={pIdx}
                                          className="relative w-16 h-16 bg-white rounded-md p-1 border border-[var(--ln)] shadow-2xs group"
                                        >
                                          <img
                                            src={photoUrl}
                                            alt=""
                                            className="w-full h-full object-contain"
                                          />
                                          <button
                                            type="button"
                                            title="Retirer cette photo"
                                            onClick={() => {
                                              const nextCols = [...(admEditingProd.colors || [])];
                                              nextCols[colIdx].i.splice(pIdx, 1);
                                              setAdmEditingProd({
                                                ...admEditingProd,
                                                colors: nextCols,
                                              });
                                            }}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-[10px] text-[var(--mut)]">
                                      La première photo est la photo principale affichée.
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-[var(--mut)] italic">
                                    Aucune photo encore ajoutée pour cette couleur.
                                  </p>
                                )}
                              </div>

                              {/* STOCK FOR THIS COLOR */}
                              <div className="pt-1">
                                <span className="block text-[11px] font-semibold mb-1">
                                  Stock disponible pour la couleur {col.n} :
                                </span>

                                {(admEditingProd.sizes || []).length > 0 ? (
                                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    {(admEditingProd.sizes || []).map((szName) => {
                                      const currentStk =
                                        typeof col.st === 'object' && col.st !== null
                                          ? Number(col.st[szName] || 0)
                                          : 0;
                                      return (
                                        <div key={szName}>
                                          <span className="block text-[10px] font-bold text-[var(--mut)] uppercase text-center mb-0.5">
                                            {szName}
                                          </span>
                                          <input
                                            type="number"
                                            min="0"
                                            value={currentStk}
                                            onChange={(e) => {
                                              const nextCols = [...(admEditingProd.colors || [])];
                                              const obj =
                                                typeof nextCols[colIdx].st === 'object' &&
                                                nextCols[colIdx].st !== null
                                                  ? { ...(nextCols[colIdx].st as Record<string, number>) }
                                                  : {};
                                              obj[szName] = Number(e.target.value);
                                              nextCols[colIdx].st = obj;
                                              setAdmEditingProd({
                                                ...admEditingProd,
                                                colors: nextCols,
                                              });
                                            }}
                                            className="w-full h-8 px-1 text-center font-bold text-xs border border-[var(--ln)] bg-[var(--card)] rounded-md"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="w-36">
                                    <input
                                      type="number"
                                      min="0"
                                      value={Number(col.st || 0)}
                                      onChange={(e) => {
                                        const nextCols = [...(admEditingProd.colors || [])];
                                        nextCols[colIdx].st = Number(e.target.value);
                                        setAdmEditingProd({
                                          ...admEditingProd,
                                          colors: nextCols,
                                        });
                                      }}
                                      className="w-full h-9 px-2 font-bold text-xs border border-[var(--ln)] bg-[var(--card)] rounded-md"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Visibilité */}
                      <label className="flex items-center gap-2 pt-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={admEditingProd.visible !== false}
                          onChange={(e) =>
                            setAdmEditingProd({
                              ...admEditingProd,
                              visible: e.target.checked,
                            })
                          }
                          className="accent-[var(--red)] w-4 h-4"
                        />
                        <span>Article visible immédiatement sur la boutique</span>
                      </label>
                    </div>

                    {admProdError && (
                      <div className="p-2.5 bg-red-100 dark:bg-red-950/40 text-[var(--red)] text-xs font-bold rounded-md border border-red-300">
                        {admProdError}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-[var(--ln)]">
                      <button
                        type="button"
                        onClick={handleSaveProduct}
                        className="flex-1 h-11 bg-[var(--red)] text-white font-bold uppercase tracking-wider rounded-md hover:opacity-90 active:scale-99 shadow-sm"
                      >
                        Enregistrer l’article
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdmEditingProd(null)}
                        className="px-5 h-11 border border-[var(--fg)] font-bold uppercase rounded-md active:scale-95"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. SECURITY LOGS TAB */}
                {admTab === 's' && (
                  <div className="space-y-3 text-xs">
                    {/* Password change block */}
                    <form
                      onSubmit={handleUpdatePasswordInSecurity}
                      className="p-3 bg-[var(--card)] border border-[var(--ln)] rounded-md space-y-2"
                    >
                      <h4 className="font-bold text-sm">Changer le mot de passe Admin</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="password"
                          placeholder="Nouveau mot de passe"
                          value={newPasswordSetting1}
                          onChange={(e) => setNewPasswordSetting1(e.target.value)}
                          className="h-9 px-2.5 border border-[var(--ln)] bg-[var(--bg)] rounded-md"
                        />
                        <input
                          type="password"
                          placeholder="Confirmer"
                          value={newPasswordSetting2}
                          onChange={(e) => setNewPasswordSetting2(e.target.value)}
                          className="h-9 px-2.5 border border-[var(--ln)] bg-[var(--bg)] rounded-md"
                        />
                      </div>
                      <button
                        type="submit"
                        className="h-9 px-4 bg-[var(--fg)] text-[var(--bg)] font-bold uppercase rounded-md"
                      >
                        Sauvegarder
                      </button>
                    </form>

                    <h4 className="font-bold text-sm pt-2">
                      Journal des tentatives de connexion & codes e-mail
                    </h4>

                    <div className="space-y-2">
                      {securityLogs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-2.5 rounded-md border text-[11px] ${
                            log.status === 'warning'
                              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60'
                              : log.status === 'danger'
                              ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700/60'
                              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60'
                          }`}
                        >
                          <div className="flex justify-between font-bold">
                            <span>{new Date(log.timestamp).toLocaleString('fr-FR')}</span>
                            <span>{log.email}</span>
                          </div>
                          <p className="mt-1">{log.details}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
