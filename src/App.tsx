import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db, storage 
} from './lib/firebase';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword as firebaseUpdatePassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  LogOut, 
  Menu, 
  X, 
  MessageCircle, 
  LayoutDashboard, 
  ShoppingBag, 
  Settings, 
  Image as ImageIcon,
  HelpCircle,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Trash2,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import emailjs from 'emailjs-com';

type Section = 'home' | 'signin' | 'signup' | 'dashboard' | 'services' | 'manage' | 'order' | 'gallery' | 'tracking' | 'admin' | 
               'graphicDesign' | 'digitalMarketing' | 'webDev' | 'multimedia' | 'itServices' | 'photoVideo' | 'government';

interface Order {
  id: string;
  fullName: string;
  email: string;
  service: string;
  description: string;
  fileUrl: string;
  status: string;
  price: string;
  createdAt: any;
}

interface GalleryItem {
  id: string;
  imageUrl: string;
  uploadedAt: any;
}

interface Testimonial {
  id: string;
  name: string;
  text: string;
  approved: boolean;
  createdAt: any;
}

export default function App() {
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialsError, setTestimonialsError] = useState<string | null>(null);
  const [trackingResult, setTrackingResult] = useState<Order | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Form States
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', rememberMe: false });
  const [orderForm, setOrderForm] = useState({ fullName: '', email: '', service: '', description: '', file: null as File | null });
  const [manageForm, setManageForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [testimonialForm, setTestimonialForm] = useState({ name: '', text: '' });
  const [trackingCode, setTrackingCode] = useState('');
  const [galleryFile, setGalleryFile] = useState<File | null>(null);

  useEffect(() => {
    loadTestimonials();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Simple admin check - you might want a more robust check in a real app
        if (u.email === 'admin@mcoreda.com' || u.email === 'mcoredatech@gmail.com') {
          setIsAdmin(true);
        }
        if (currentSection === 'home' || currentSection === 'signin' || currentSection === 'signup') {
          setCurrentSection('dashboard');
        }
      } else {
        setIsAdmin(false);
      }
    });
    return unsubscribe;
  }, [currentSection]);

  useEffect(() => {
    if (currentSection === 'gallery') loadGallery();
    if (currentSection === 'admin' && isAdmin) loadOrders();
  }, [currentSection, isAdmin]);

  const loadOrders = async () => {
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(data);
    } catch (err) {
      console.error("Error loading orders:", err);
    }
  };

  const loadGallery = async () => {
    setGalleryLoading(true);
    setGalleryError(null);
    try {
      const q = query(collection(db, 'gallery'), orderBy('uploadedAt', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GalleryItem));
      setGallery(data);
    } catch (err: any) {
      console.error("Error loading gallery:", err);
      if (err.code === 'permission-denied') {
        setGalleryError("Access Denied: Please update your Firebase Firestore Security Rules to allow public reads for the 'gallery' collection.");
      } else {
        setGalleryError("Failed to load gallery. Please try again later.");
      }
    } finally {
      setGalleryLoading(false);
    }
  };

  const loadTestimonials = async () => {
    setTestimonialsError(null);
    try {
      const q = query(collection(db, 'testimonials'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Testimonial));
      setTestimonials(data);
    } catch (err: any) {
      console.error("Error loading testimonials:", err);
      if (err.code === 'permission-denied') {
        setTestimonialsError("Access Denied: Please update your Firebase Firestore Security Rules for the 'testimonials' collection.");
      }
    }
  };

  const handleTestimonialSubmit = async () => {
    if (!testimonialForm.name || !testimonialForm.text) return alert("Please fill all fields");
    try {
      await addDoc(collection(db, 'testimonials'), {
        ...testimonialForm,
        approved: false,
        createdAt: serverTimestamp()
      });
      alert("Testimonial submitted! It will appear once approved by admin.");
      setTestimonialForm({ name: '', text: '' });
    } catch (err: any) { alert(err.message); }
  };

  const handleTrackOrder = async () => {
    if (!trackingCode) return alert("Enter order code");
    try {
      const orderRef = doc(db, 'orders', trackingCode.trim());
      const snap = await getDoc(orderRef);
      if (snap.exists()) {
        setTrackingResult({ id: snap.id, ...snap.data() } as Order);
      } else {
        alert("Order not found. Please check the ID and try again.");
        setTrackingResult(null);
      }
    } catch (err: any) { 
      console.error("Tracking error:", err);
      alert("Error: " + err.message); 
    }
  };

  const handleSignUp = async () => {
    if (!authForm.name || !authForm.email || !authForm.password) {
      alert('Please fill in all fields');
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      await updateProfile(cred.user, { displayName: authForm.name });
      alert('Account created! Please sign in.');
      setCurrentSection('signin');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSignIn = async () => {
    if (!authForm.email || !authForm.password) {
      alert('Please enter email and password');
      return;
    }
    try {
      await setPersistence(auth, authForm.rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      alert('Signed in successfully!');
      setCurrentSection('dashboard');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentSection('home');
  };

  const handleOrderSubmit = async () => {
    if (!orderForm.fullName || !orderForm.email || !orderForm.service) {
      alert('Please fill required fields');
      return;
    }
    try {
      let fileUrl = '';
      if (orderForm.file) {
        const fileRef = ref(storage, `orders/${Date.now()}_${orderForm.file.name}`);
        await uploadBytes(fileRef, orderForm.file);
        fileUrl = await getDownloadURL(fileRef);
      }

      await addDoc(collection(db, 'orders'), {
        fullName: orderForm.fullName,
        email: orderForm.email,
        service: orderForm.service,
        description: orderForm.description,
        fileUrl,
        status: 'Pending',
        price: 'Not Assigned',
        createdAt: serverTimestamp()
      });

      // Send Email Notification
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

      if (serviceId && templateId && publicKey) {
        emailjs.send(serviceId, templateId, {
          to_name: "Admin",
          from_name: orderForm.fullName,
          message: `New order for ${orderForm.service}. Description: ${orderForm.description}`,
          reply_to: orderForm.email
        }, publicKey).catch(e => console.error("Email failed:", e));
      }

      alert('Order submitted successfully!');
      setOrderForm({ fullName: '', email: '', service: '', description: '', file: null });
      setCurrentSection('dashboard');
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  const handleGalleryUpload = async () => {
    if (!galleryFile) return alert('Select an image');
    try {
      const fileRef = ref(storage, `gallery/${Date.now()}_${galleryFile.name}`);
      await uploadBytes(fileRef, galleryFile);
      const imageUrl = await getDownloadURL(fileRef);
      await addDoc(collection(db, 'gallery'), {
        imageUrl,
        uploadedAt: serverTimestamp()
      });
      alert('Uploaded!');
      setGalleryFile(null);
      loadGallery();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const updateOrderStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      loadOrders();
    } catch (err: any) { alert(err.message); }
  };

  const setOrderPrice = async (id: string) => {
    const price = prompt("Enter price in KES:");
    if (!price) return;
    try {
      await updateDoc(doc(db, 'orders', id), { price: `KES ${price}` });
      loadOrders();
    } catch (err: any) { alert(err.message); }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Delete this order?")) return;
    try {
      await deleteDoc(doc(db, 'orders', id));
      loadOrders();
    } catch (err: any) { alert(err.message); }
  };

  const approveTestimonial = async (id: string) => {
    try {
      await updateDoc(doc(db, 'testimonials', id), { approved: true });
      loadTestimonials();
    } catch (err: any) { alert(err.message); }
  };

  const deleteTestimonial = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return;
    try {
      await deleteDoc(doc(db, 'testimonials', id));
      loadTestimonials();
    } catch (err: any) { alert(err.message); }
  };

  const handleChangePassword = async () => {
    if (!user || !manageForm.currentPassword || !manageForm.newPassword) return;
    if (manageForm.newPassword !== manageForm.confirmNewPassword) return alert("Passwords don't match");
    try {
      const credential = EmailAuthProvider.credential(user.email!, manageForm.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await firebaseUpdatePassword(user, manageForm.newPassword);
      alert('Password updated!');
      setManageForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-brand-blue text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight cursor-pointer" onClick={() => setCurrentSection('home')}>
            MC'OREDA TECH & ART
          </h1>
          
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => setCurrentSection('home')} className={`hover:underline ${currentSection === 'home' ? 'underline' : ''}`}>Home</button>
            <button onClick={() => setCurrentSection('tracking')} className={`hover:underline ${currentSection === 'tracking' ? 'underline' : ''}`}>Track Order</button>
            {!user ? (
              <>
                <button onClick={() => setCurrentSection('signin')} className={`hover:underline ${currentSection === 'signin' ? 'underline' : ''}`}>Sign In</button>
                <button onClick={() => setCurrentSection('signup')} className={`hover:underline ${currentSection === 'signup' ? 'underline' : ''}`}>Sign Up</button>
              </>
            ) : (
              <>
                <button onClick={() => setCurrentSection('dashboard')} className={`hover:underline ${currentSection === 'dashboard' ? 'underline' : ''}`}>Dashboard</button>
                <button onClick={() => setCurrentSection('manage')} className={`hover:underline ${currentSection === 'manage' ? 'underline' : ''}`}>Manage</button>
                {isAdmin && <button onClick={() => setCurrentSection('admin')} className="text-yellow-400 font-bold">Admin</button>}
                <button onClick={handleLogout} className="flex items-center gap-1 text-red-300 hover:text-red-100">
                  <LogOut size={18} /> Logout
                </button>
              </>
            )}
          </nav>

          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-brand-blue border-t border-white/10 overflow-hidden"
            >
              <div className="flex flex-col p-4 gap-4">
                <button onClick={() => { setCurrentSection('home'); setIsMenuOpen(false); }}>Home</button>
                {!user ? (
                  <>
                    <button onClick={() => { setCurrentSection('signin'); setIsMenuOpen(false); }}>Sign In</button>
                    <button onClick={() => { setCurrentSection('signup'); setIsMenuOpen(false); }}>Sign Up</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setCurrentSection('dashboard'); setIsMenuOpen(false); }}>Dashboard</button>
                    <button onClick={() => { setCurrentSection('manage'); setIsMenuOpen(false); }}>Manage</button>
                    {isAdmin && <button onClick={() => { setCurrentSection('admin'); setIsMenuOpen(false); }}>Admin</button>}
                    <button onClick={handleLogout}>Logout</button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full p-6">
        <AnimatePresence mode="wait">
          {currentSection === 'home' && (
            <motion.section 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-12"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-brand-blue mb-4">Welcome to MC'Oreda Tech & Art Agency</h2>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">Your one-stop destination for creative designs, modern web solutions, and professional IT support.</p>
              <div className="flex flex-wrap justify-center gap-4 mb-12">
                <button onClick={() => setCurrentSection('signin')} className="btn-primary">Sign In</button>
                <button onClick={() => setCurrentSection('signup')} className="btn-outline">Sign Up</button>
              </div>
              <div className="card max-w-sm mx-auto">
                <Settings className="text-brand-accent mb-2" size={32} />
                <h4 className="text-lg font-bold text-brand-blue">Manage Account</h4>
                <p className="text-sm text-gray-500 mb-4">Access management tools and control your workflow.</p>
                <button onClick={() => setCurrentSection('manage')} className="btn-primary w-full">Manage</button>
              </div>

              {/* Testimonials Section */}
              <div className="mt-20">
                <h3 className="text-3xl font-bold text-brand-blue mb-8">Client Testimonials</h3>
                
                {testimonialsError && (
                  <div className="max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-8 text-sm text-center">
                    {testimonialsError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                  {testimonials.filter(t => t.approved).map(t => (
                    <div key={t.id} className="bg-white p-6 rounded-xl shadow-md italic text-gray-600 relative">
                      <span className="text-4xl text-brand-accent opacity-20 absolute top-2 left-2">"</span>
                      <p className="mb-4">{t.text}</p>
                      <div className="font-bold text-brand-blue not-italic">— {t.name}</div>
                    </div>
                  ))}
                  {testimonials.filter(t => t.approved).length === 0 && <p className="col-span-full text-gray-400">No reviews yet. Be the first!</p>}
                </div>
                
                <div className="form-box max-w-md">
                  <h4 className="font-bold text-brand-blue">Leave a Review</h4>
                  <input 
                    type="text" 
                    placeholder="Your Name" 
                    className="input-field"
                    value={testimonialForm.name}
                    onChange={e => setTestimonialForm({...testimonialForm, name: e.target.value})}
                  />
                  <textarea 
                    placeholder="Your experience..." 
                    className="input-field"
                    value={testimonialForm.text}
                    onChange={e => setTestimonialForm({...testimonialForm, text: e.target.value})}
                  />
                  <button onClick={handleTestimonialSubmit} className="btn-primary">Submit Review</button>
                </div>
              </div>
            </motion.section>
          )}

          {currentSection === 'signin' && (
            <motion.section key="signin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="form-box">
                <h2 className="text-2xl font-bold text-brand-blue text-center">Sign In</h2>
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="input-field"
                  value={authForm.email}
                  onChange={e => setAuthForm({...authForm, email: e.target.value})}
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="input-field"
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})}
                />
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={authForm.rememberMe}
                      onChange={e => setAuthForm({...authForm, rememberMe: e.target.checked})}
                    /> Remember Me
                  </label>
                  <button className="text-brand-accent hover:underline" onClick={() => alert('Password reset link sent!')}>Forgot Password?</button>
                </div>
                <button onClick={handleSignIn} className="btn-primary">Login</button>
                <p className="text-center text-sm">Don't have an account? <button onClick={() => setCurrentSection('signup')} className="text-brand-accent font-bold">Sign Up</button></p>
              </div>
            </motion.section>
          )}

          {currentSection === 'signup' && (
            <motion.section key="signup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="form-box">
                <h2 className="text-2xl font-bold text-brand-blue text-center">Create Account</h2>
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  className="input-field"
                  value={authForm.name}
                  onChange={e => setAuthForm({...authForm, name: e.target.value})}
                />
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="input-field"
                  value={authForm.email}
                  onChange={e => setAuthForm({...authForm, email: e.target.value})}
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="input-field"
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})}
                />
                <button onClick={handleSignUp} className="btn-primary">Sign Up</button>
                <p className="text-center text-sm">Already have an account? <button onClick={() => setCurrentSection('signin')} className="text-brand-accent font-bold">Sign In</button></p>
              </div>
            </motion.section>
          )}

          {currentSection === 'dashboard' && (
            <motion.section key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <h2 className="text-3xl font-bold text-brand-blue mb-2">Welcome, {user?.displayName || 'User'}!</h2>
              <p className="text-gray-600 mb-8">You are now signed in to MC'Oreda Tech & Art Agency.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card">
                  <LayoutDashboard className="text-brand-accent" size={32} />
                  <h3 className="font-bold">Services</h3>
                  <p className="text-sm text-gray-500">Explore our wide range of professional services.</p>
                  <button onClick={() => setCurrentSection('services')} className="btn-primary w-full mt-auto">View Services</button>
                </div>
                <div className="card">
                  <ImageIcon className="text-brand-accent" size={32} />
                  <h3 className="font-bold">Projects</h3>
                  <p className="text-sm text-gray-500">Check out our portfolio and sample designs.</p>
                  <button onClick={() => setCurrentSection('gallery')} className="btn-primary w-full mt-auto">View Gallery</button>
                </div>
                <div className="card">
                  <ShoppingBag className="text-brand-accent" size={32} />
                  <h3 className="font-bold">Order</h3>
                  <p className="text-sm text-gray-500">Ready to start? Place your custom order now.</p>
                  <button onClick={() => setCurrentSection('order')} className="btn-primary w-full mt-auto">Order Now</button>
                </div>
                <div className="card">
                  <HelpCircle className="text-brand-accent" size={32} />
                  <h3 className="font-bold">Contact</h3>
                  <p className="text-sm text-gray-500">Need help? Get in touch with our support team.</p>
                  <button onClick={() => alert('Call: 0784194556\nEmail: mcoredatech@gmail.com')} className="btn-primary w-full mt-auto">Get Help</button>
                </div>
              </div>
            </motion.section>
          )}

          {currentSection === 'services' && (
            <motion.section key="services" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <h2 className="text-3xl font-bold text-brand-blue mb-4">Our Services</h2>
              <p className="text-gray-600 mb-8">Click a category below to view detailed services.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { id: 'graphicDesign', title: 'Graphic Design', desc: 'Branding, visuals & creative designs' },
                  { id: 'digitalMarketing', title: 'Digital Marketing', desc: 'Grow your brand online' },
                  { id: 'webDev', title: 'Web Development', desc: 'Modern, responsive websites' },
                  { id: 'multimedia', title: 'Multimedia & Animation', desc: 'Motion, animation & video' },
                  { id: 'itServices', title: 'IT Solutions', desc: 'Technical & computer services' },
                  { id: 'photoVideo', title: 'Photography & Videography', desc: 'Professional media coverage' },
                  { id: 'government', title: 'Government Services', desc: 'Registration & compliance' },
                ].map(s => (
                  <div key={s.id} className="card">
                    <h3 className="font-bold text-lg">{s.title}</h3>
                    <p className="text-sm text-gray-500 mb-4">{s.desc}</p>
                    <button onClick={() => setCurrentSection(s.id as Section)} className="btn-primary w-full">View Details</button>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Service Detail Sections */}
          {['graphicDesign', 'digitalMarketing', 'webDev', 'multimedia', 'itServices', 'photoVideo', 'government'].includes(currentSection) && (
            <motion.section key={currentSection} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-2xl mx-auto">
              <button onClick={() => setCurrentSection('services')} className="text-brand-accent mb-4 hover:underline flex items-center gap-1">← Back to Services</button>
              <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h2 className="text-3xl font-bold text-brand-blue mb-6 capitalize">
                  {currentSection.replace(/([A-Z])/g, ' $1').trim()}
                </h2>
                <ul className="space-y-3 mb-8">
                  {currentSection === 'graphicDesign' && (
                    <>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Logo design & branding</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Marketing materials (flyers, brochures)</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Social media graphics</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Packaging design</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Photo & Video editing</li>
                    </>
                  )}
                  {currentSection === 'digitalMarketing' && (
                    <>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Social media management</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Content creation & strategy</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> SEO (Search Engine Optimization)</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Email marketing campaigns</li>
                    </>
                  )}
                  {currentSection === 'webDev' && (
                    <>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Portfolio websites & CVs</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Responsive website design</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> E-commerce development</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Maintenance & support</li>
                    </>
                  )}
                  {currentSection === 'multimedia' && (
                    <>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Motion graphics</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> 2D / 3D animation</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Explainer videos</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Logo animations</li>
                    </>
                  )}
                  {currentSection === 'itServices' && (
                    <>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> IT consulting & strategy</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Technical support</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Software installation</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Wi-Fi setup & networking</li>
                    </>
                  )}
                  {currentSection === 'photoVideo' && (
                    <>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Corporate photography</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Event coverage</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Product photography</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Video production</li>
                    </>
                  )}
                  {currentSection === 'government' && (
                    <>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> KRA registration & compliance</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> Company registration</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> KUCCPS & HELB applications</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500" /> E-Citizen services</li>
                    </>
                  )}
                </ul>
                <button onClick={() => setCurrentSection('order')} className="btn-primary w-full">Order Service Here</button>
              </div>
            </motion.section>
          )}

          {currentSection === 'order' && (
            <motion.section key="order" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="form-box max-w-lg">
                <h2 className="text-2xl font-bold text-brand-blue text-center">Place Your Order</h2>
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  className="input-field"
                  value={orderForm.fullName}
                  onChange={e => setOrderForm({...orderForm, fullName: e.target.value})}
                />
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="input-field"
                  value={orderForm.email}
                  onChange={e => setOrderForm({...orderForm, email: e.target.value})}
                />
                <select 
                  className="input-field"
                  value={orderForm.service}
                  onChange={e => setOrderForm({...orderForm, service: e.target.value})}
                >
                  <option value="" disabled>Select category of your service</option>
                  <option>Graphic Design</option>
                  <option>Digital Marketing</option>
                  <option>Web Development & Design</option>
                  <option>Multimedia and Animation</option>
                  <option>IT Solutions & Support</option>
                  <option>Photography & Videography</option>
                  <option>Government Services</option>
                  <option>Other Services</option>
                </select>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Attach Reference File (Optional)</label>
                  <input 
                    type="file" 
                    className="input-field"
                    onChange={e => setOrderForm({...orderForm, file: e.target.files?.[0] || null})}
                  />
                </div>
                <textarea 
                  placeholder="Describe your project..." 
                  className="input-field min-h-32"
                  value={orderForm.description}
                  onChange={e => setOrderForm({...orderForm, description: e.target.value})}
                />
                <button onClick={handleOrderSubmit} className="btn-primary">Submit Order</button>
                <a 
                  href="https://wa.me/254784194556?text=Hello%20MC'Oreda%20Tech%20Agency,%20I%20would%20like%20to%20make%20an%20order." 
                  target="_blank"
                  className="bg-[#25D366] text-white p-3 rounded-lg font-bold text-center hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <MessageCircle size={20} /> Order via WhatsApp
                </a>
              </div>
            </motion.section>
          )}

          {currentSection === 'gallery' && (
            <motion.section key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-3xl font-bold text-brand-blue text-center mb-8">Project Gallery</h2>
              
              {galleryLoading && <div className="text-center py-12">Loading projects...</div>}
              
              {galleryError && (
                <div className="max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-8 text-sm text-center">
                  {galleryError}
                </div>
              )}

              {!galleryLoading && !galleryError && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
                  {gallery.map(item => (
                    <motion.div key={item.id} layout className="rounded-xl overflow-hidden shadow-md aspect-square bg-gray-200">
                      <img src={item.imageUrl} alt="Gallery" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </motion.div>
                  ))}
                  {gallery.length === 0 && <p className="col-span-full text-center text-gray-500">No projects to display yet.</p>}
                </div>
              )}

              {user && (
                <div className="form-box">
                  <h3 className="text-xl font-bold text-brand-blue text-center">Upload Your Work</h3>
                  <input 
                    type="file" 
                    accept="image/*"
                    className="input-field"
                    onChange={e => setGalleryFile(e.target.files?.[0] || null)}
                  />
                  <button onClick={handleGalleryUpload} className="btn-primary">Upload to Gallery</button>
                </div>
              )}
            </motion.section>
          )}

          {currentSection === 'manage' && (
            <motion.section key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="form-box">
                <h2 className="text-2xl font-bold text-brand-blue text-center">Manage Account</h2>
                <div className="space-y-4">
                  <h3 className="font-bold border-b pb-2">Change Password</h3>
                  <input 
                    type="password" 
                    placeholder="Current Password" 
                    className="input-field"
                    value={manageForm.currentPassword}
                    onChange={e => setManageForm({...manageForm, currentPassword: e.target.value})}
                  />
                  <input 
                    type="password" 
                    placeholder="New Password" 
                    className="input-field"
                    value={manageForm.newPassword}
                    onChange={e => setManageForm({...manageForm, newPassword: e.target.value})}
                  />
                  <input 
                    type="password" 
                    placeholder="Confirm New Password" 
                    className="input-field"
                    value={manageForm.confirmNewPassword}
                    onChange={e => setManageForm({...manageForm, confirmNewPassword: e.target.value})}
                  />
                  <button onClick={handleChangePassword} className="btn-primary w-full">Update Password</button>
                </div>
                <div className="mt-8 space-y-4">
                  <h3 className="font-bold border-b pb-2">Account Controls</h3>
                  <button onClick={() => alert('Account settings updated!')} className="btn-outline w-full">Save Settings</button>
                  <button onClick={() => alert('Account deactivated!')} className="text-red-500 text-sm hover:underline w-full">Deactivate Account</button>
                </div>
              </div>
            </motion.section>
          )}

          {currentSection === 'tracking' && (
            <motion.section key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="form-box max-w-md">
                <h2 className="text-2xl font-bold text-brand-blue text-center">Track Your Order</h2>
                <p className="text-sm text-gray-500 text-center mb-4">Enter your unique Order ID to check progress.</p>
                <input 
                  type="text" 
                  placeholder="Order ID (e.g. abc123...)" 
                  className="input-field"
                  value={trackingCode}
                  onChange={e => setTrackingCode(e.target.value)}
                />
                <button onClick={handleTrackOrder} className="btn-primary">Track Progress</button>
                
                {trackingResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                    <h3 className="font-bold text-brand-blue mb-4">Order Status</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span>Service:</span> <span className="font-bold">{trackingResult.service}</span></div>
                      <div className="flex justify-between"><span>Status:</span> 
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          trackingResult.status === 'Pending' ? 'bg-yellow-200 text-yellow-800' :
                          trackingResult.status === 'Approved' ? 'bg-blue-200 text-blue-800' :
                          trackingResult.status === 'In Progress' ? 'bg-purple-200 text-purple-800' :
                          'bg-green-200 text-green-800'
                        }`}>
                          {trackingResult.status}
                        </span>
                      </div>
                      <div className="flex justify-between"><span>Price:</span> <span className="font-bold text-brand-accent">{trackingResult.price}</span></div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.section>
          )}

          {currentSection === 'admin' && isAdmin && (
            <motion.section key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-3xl font-bold text-brand-blue text-center mb-8">Admin Dashboard</h2>
              <div className="overflow-x-auto bg-white rounded-2xl shadow-xl">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="bg-brand-blue text-white">
                    <tr>
                      <th className="p-4 text-sm font-semibold">Order ID</th>
                      <th className="p-4 text-sm font-semibold">Customer Name</th>
                      <th className="p-4 text-sm font-semibold">Email</th>
                      <th className="p-4 text-sm font-semibold">Service</th>
                      <th className="p-4 text-sm font-semibold">Status</th>
                      <th className="p-4 text-sm font-semibold">Price</th>
                      <th className="p-4 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-xs font-mono text-gray-500">{order.id.substring(0, 8)}...</td>
                        <td className="p-4 font-medium">{order.fullName}</td>
                        <td className="p-4 text-sm text-gray-600">{order.email}</td>
                        <td className="p-4 text-sm">{order.service}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                            order.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                            order.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                            order.status === 'In Progress' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-sm font-semibold text-brand-blue">{order.price}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateOrderStatus(order.id, 'Approved')} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Approve"><CheckCircle2 size={16} /></button>
                            <button onClick={() => updateOrderStatus(order.id, 'In Progress')} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="In Progress"><Clock size={16} /></button>
                            <button onClick={() => updateOrderStatus(order.id, 'Completed')} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Complete"><CheckCircle2 size={16} /></button>
                            <button onClick={() => setOrderPrice(order.id)} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="Set Price"><DollarSign size={16} /></button>
                            <button onClick={() => deleteOrder(order.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-gray-500 italic">No orders found in the system.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-12">
                <h3 className="text-2xl font-bold text-brand-blue mb-6">Manage Testimonials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {testimonials.map(t => (
                    <div key={t.id} className={`p-4 rounded-xl border ${t.approved ? 'bg-green-50 border-green-100' : 'bg-yellow-50 border-yellow-100'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold">{t.name}</span>
                        <div className="flex gap-2">
                          {!t.approved && <button onClick={() => approveTestimonial(t.id)} className="text-green-600 hover:underline text-sm">Approve</button>}
                          <button onClick={() => deleteTestimonial(t.id)} className="text-red-600 hover:underline text-sm">Delete</button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 italic">"{t.text}"</p>
                    </div>
                  ))}
                  {testimonials.length === 0 && <p className="text-gray-500">No testimonials to manage.</p>}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Floating WhatsApp */}
      <a 
        href="https://wa.me/254784194556?text=Hello%20MC'Oreda%20Tech%20Agency" 
        target="_blank"
        className="fixed bottom-6 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-50 flex items-center justify-center"
      >
        <MessageCircle size={32} />
      </a>

      {/* Footer */}
      <footer className="bg-brand-blue text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex justify-center gap-8 mb-4">
            <div className="flex items-center gap-2"><Phone size={18} /> 0784194556</div>
            <div className="flex items-center gap-2"><Mail size={18} /> mcoredatech@gmail.com</div>
          </div>
          <p className="text-sm opacity-70">© 2025 MC'Oreda Tech & Art Agency. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
