import React, { useState, useEffect, useRef } from 'react';
import { productImage } from '../data/productImage';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getPricing } from '../services/api';
import { normalizePhMobile, codBlockReason, PHONE_HINT } from '../services/checkout';
import { useIsPhone } from './ui/useMediaQuery';
import { 
    Search, Filter, ShoppingBag, ShoppingCart, Plus, Minus, X, Check, ArrowRight, Leaf, 
    Trash2, CreditCard, DollarSign, Sparkles, Star, Shield, HelpCircle, MapPin, Info, ChevronDown
} from 'lucide-react';

/* ─── Static Metadata Mappings for Inventory Items ─── */
const PRODUCT_METADATA = {
    "Coconut Palm": {
        light: "Full Sun",
        care: "Low Maintenance",
        material: "Organic",
        dimensions: "Height: 5m - 8m, Spread: 3m",
        careInstructions: "Water deeply twice a week when young. Plant in well-draining sandy soil with full sunlight exposure.",
        unsplashUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop"
    },
    "Bougainvillea": {
        light: "Full Sun",
        care: "Low Maintenance",
        material: "Organic",
        dimensions: "Height: 1m - 3m (climbing/shrub)",
        careInstructions: "Thrives in hot, dry climates. Water only when the soil is completely dry. Prune after flowering cycles to promote blooms.",
        unsplashUrl: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?q=80&w=600&auto=format&fit=crop"
    },
    "Bamboo Cluster": {
        light: "Partial Shade",
        care: "Low Maintenance",
        material: "Organic",
        dimensions: "Height: 3m - 5m, Spread: 1.5m",
        careInstructions: "Water regularly to keep the soil consistently damp. Thrives in bright indirect sunlight. Perfect for boundary screen planting.",
        unsplashUrl: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?q=80&w=600&auto=format&fit=crop"
    },
    "Frangipani": {
        light: "Full Sun",
        care: "Low Maintenance",
        material: "Organic",
        dimensions: "Height: 3m - 4m, Spread: 2.5m",
        careInstructions: "Drought resistant once established. Avoid waterlogging. Requires at least 6 hours of direct sunlight daily.",
        unsplashUrl: "https://images.unsplash.com/photo-1534067783941-51c9c23eccfd?q=80&w=600&auto=format&fit=crop"
    },
    "Bird of Paradise": {
        light: "Full Sun",
        care: "Moderate Care",
        material: "Organic",
        dimensions: "Height: 1.2m - 1.6m, Spread: 1.2m",
        careInstructions: "Needs high ambient humidity. Keep the soil moist but not soggy during active growth. Wipe broad leaves regularly.",
        unsplashUrl: "https://images.unsplash.com/photo-1508672019048-805c876b67e2?q=80&w=600&auto=format&fit=crop"
    },
    "Banana Plant": {
        light: "Full Sun",
        care: "Moderate Care",
        material: "Organic",
        dimensions: "Height: 2m - 3m, Spread: 2m",
        careInstructions: "Water daily to support massive leaf transpiration. Feed weekly with nitrogen-rich organic fertilizer during growing season.",
        unsplashUrl: "https://images.unsplash.com/photo-1525498128493-380d1990a112?q=80&w=600&auto=format&fit=crop"
    },
    "Traveler's Palm": {
        light: "Full Sun",
        care: "Moderate Care",
        material: "Organic",
        dimensions: "Height: 4m - 6m, Fan Width: 3m",
        careInstructions: "Protect from strong gusty winds that shred the fan blades. Plant in nutrient-rich soil and water frequently.",
        unsplashUrl: "https://images.unsplash.com/photo-1546272989-40c929af9c50?q=80&w=600&auto=format&fit=crop"
    },
    "Hibiscus": {
        light: "Full Sun",
        care: "Moderate Care",
        material: "Organic",
        dimensions: "Height: 1m - 1.8m, Spread: 1.2m",
        careInstructions: "Water daily during hot periods. Prune tips to encourage bushy structure and continuous budding.",
        unsplashUrl: "https://images.unsplash.com/photo-1550950158-d0d960dff51b?q=80&w=600&auto=format&fit=crop"
    },
    "Golden Duranta": {
        light: "Full Sun",
        care: "Low Maintenance",
        material: "Organic",
        dimensions: "Height: 0.5m - 1.2m (trimmed)",
        careInstructions: "Trim regularly to keep formal hedge shapes. Water moderately. The golden color intensifies with more sunlight.",
        unsplashUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=600&auto=format&fit=crop"
    },
    "Santan": {
        light: "Full Sun",
        care: "Low Maintenance",
        material: "Organic",
        dimensions: "Height: 0.4m - 0.8m, Spread: 0.6m",
        careInstructions: "Prefers slightly acidic soil. Water moderately. Feed with potash-heavy fertilizer to promote dense round bloom clusters.",
        unsplashUrl: "https://images.unsplash.com/photo-1501004318641-72ee46df725f?q=80&w=600&auto=format&fit=crop"
    },
    "River Stones": {
        light: "N/A",
        care: "Low Maintenance",
        material: "Natural Stone",
        dimensions: "Average Size: 3cm - 8cm mix",
        careInstructions: "Hose down twice a year to clear garden soil runoff. Prevents mud splashes and retains moisture.",
        unsplashUrl: "https://images.unsplash.com/photo-1533460004989-cef01064af7e?q=80&w=600&auto=format&fit=crop"
    },
    "Stepping Path": {
        light: "N/A",
        care: "Low Maintenance",
        material: "Natural Stone",
        dimensions: "40cm L x 40cm W x 5cm Thickness",
        careInstructions: "Scrub or pressure-wash once a year to clear moss and algae buildup to prevent slippery surfaces.",
        unsplashUrl: "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?q=80&w=600&auto=format&fit=crop"
    },
    "Garden Bench": {
        light: "N/A",
        care: "Low Maintenance",
        material: "Teak Wood",
        dimensions: "150cm Width x 65cm Depth x 90cm Height",
        careInstructions: "Leave natural to weather into a classic silver patina, or apply specialized teak sealer oil annually to preserve golden tone.",
        unsplashUrl: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=600&auto=format&fit=crop"
    },
    "Trellis Arch": {
        light: "N/A",
        care: "Low Maintenance",
        material: "Galvanized Steel",
        dimensions: "120cm Width x 40cm Depth x 220cm Height",
        careInstructions: "Secure firmly to ground stakes. Wipe clean with a soft soapy cloth. Coated with premium anti-rust weather sealant.",
        unsplashUrl: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?q=80&w=600&auto=format&fit=crop"
    },
    "Solar Light": {
        light: "Full Sun (For Solar Panel)",
        care: "Low Maintenance",
        material: "Metal",
        dimensions: "12cm Diameter x 45cm Height",
        careInstructions: "Place in an area that gets direct sunlight. Wipe the top solar collector panel glass clean to maintain efficient charging.",
        unsplashUrl: "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?q=80&w=600&auto=format&fit=crop"
    }
};

const DEFAULT_LIFESTYLE_IMAGE = "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?q=80&w=800&auto=format&fit=crop";

// Uploaded photo (or one rendered from the 3D model in Inventory), else the image link
const getProductImage = productImage;

export default function Shop() {
    const { authTokens, user } = useAuth();
    const { addToCart, cart, removeFromCart, updateQuantity, cartSubtotal, clearCart } = useCart();
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Active categories tab
    const [activeTab, setActiveTab] = useState('All'); // 'All', 'plant', 'furniture', 'hardscape'
    const [filtersOpen, setFiltersOpen] = useState(false); // phones/tablets: filter panel folds away
    const isPhone = useIsPhone();
    const productsRef = useRef(null);

    // Filtering & Searching state
    const [searchQuery, setSearchQuery] = useState('');
    const [maxPrice, setMaxPrice] = useState(6000);
    const [selectedLights, setSelectedLights] = useState(new Set());
    const [selectedCares, setSelectedCares] = useState(new Set());
    const [selectedMaterials, setSelectedMaterials] = useState(new Set());

    // Selected product for detailed modal
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [productReviews, setProductReviews] = useState(null); // null = loading

    // Load public customer reviews whenever a product's detail modal opens
    useEffect(() => {
        if (!selectedProduct) return;
        let cancelled = false;
        setProductReviews(null);
        fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/product-reviews/public/?product=${selectedProduct.id}`)
            .then(res => res.ok ? res.json() : [])
            .then(data => { if (!cancelled) setProductReviews(Array.isArray(data) ? data : []); })
            .catch(() => { if (!cancelled) setProductReviews([]); });
        return () => { cancelled = true; };
    }, [selectedProduct]);

    // Drawer state
    // /shop?cart=open (e.g. after "Add these plants to my cart" in the AI Designer) opens the cart
    const [isCartOpen, setIsCartOpen] = useState(() => new URLSearchParams(window.location.search).get('cart') === 'open');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    // Checkout form state
    const [checkoutForm, setCheckoutForm] = useState({
        name: user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '',
        email: user?.email || '',
        phone: '',
        address: ''
    });
    const [paymentMethod, setPaymentMethod] = useState('online'); // 'online' (PayMongo) or 'cod'
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');

    // Delivery fee from the admin rate card; the server prices the order itself, this is for display
    const [shippingFee, setShippingFee] = useState(150);
    const [codMax, setCodMax] = useState(5000);
    useEffect(() => {
        getPricing().then(p => {
            setShippingFee(Number(p.shipping_fee));
            setCodMax(Number(p.cod_max_amount ?? 5000));
        }).catch(() => {});
    }, []);
    const grandTotal = cartSubtotal > 0 ? cartSubtotal + shippingFee : 0;

    const codBlocked = codBlockReason({ total: grandTotal, codMax, loggedIn: !!user });
    useEffect(() => {
        if (codBlocked && paymentMethod === 'cod') setPaymentMethod('online');
    }, [codBlocked, paymentMethod]);
    const phoneInvalid = checkoutForm.phone.trim() !== '' && !normalizePhMobile(checkoutForm.phone);

    // Fetch Products on Mount
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/inventory/`);
                if (res.ok) {
                    const data = await res.json();
                    setProducts(data);
                    // "Shop the look" links from the Project Hub open a product directly: /shop?product=<id>
                    const linked = new URLSearchParams(window.location.search).get('product');
                    const match = linked && data.find(p => String(p.id) === linked);
                    if (match) setSelectedProduct(match);
                } else {
                    setError("Failed to fetch product catalog.");
                }
            } catch (err) {
                console.error("Error fetching products:", err);
                setError("Error loading products. Check your connection.");
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    // Filter Logic
    const filteredProducts = products.filter(product => {
        // Tab Category Filter
        if (activeTab !== 'All' && product.category !== activeTab) {
            return false;
        }

        // Text Search Filter
        const query = searchQuery.toLowerCase();
        if (query && !product.name.toLowerCase().includes(query) && !product.description.toLowerCase().includes(query)) {
            return false;
        }

        // Price Filter
        if (parseFloat(product.unit_price) > maxPrice) {
            return false;
        }

        const meta = PRODUCT_METADATA[product.name] || {};

        // Category-Specific Dynamic Filters
        if (product.category === 'plant') {
            if (selectedLights.size > 0 && !selectedLights.has(meta.light)) {
                return false;
            }
            if (selectedCares.size > 0 && !selectedCares.has(meta.care)) {
                return false;
            }
        } else {
            if (selectedMaterials.size > 0 && !selectedMaterials.has(meta.material)) {
                return false;
            }
        }

        return true;
    });

    const toggleFilter = (set, setter, val) => {
        const copy = new Set(set);
        if (copy.has(val)) {
            copy.delete(val);
        } else {
            copy.add(val);
        }
        setter(copy);
    };

    const handleCheckoutSubmit = async (e) => {
        e.preventDefault();
        if (cart.length === 0) return;
        if (!checkoutForm.address || !checkoutForm.phone) {
            setCheckoutError('Please provide both delivery address and contact number.');
            return;
        }
        const phone = normalizePhMobile(checkoutForm.phone);
        if (!phone) {
            setCheckoutError(PHONE_HINT);
            return;
        }

        setIsSubmittingOrder(true);
        setCheckoutError('');

        const orderItems = cart.map(c => ({
            id: c.product.id,
            quantity: c.quantity
        }));

        try {
            // 1. Post order checkout
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/checkout/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authTokens ? `Bearer ${authTokens.access}` : ''
                },
                body: JSON.stringify({
                    customer_name: checkoutForm.name,
                    customer_email: checkoutForm.email,
                    customer_phone: phone,
                    customer_address: checkoutForm.address,
                    payment_method: paymentMethod,
                    items: orderItems,
                })
            });

            if (res.ok) {
                const data = await res.json();
                const orderId = data.order_id;
                
                // Clear cart locally
                clearCart();

                const receiptUrl = `/order-success?order_id=${orderId}&token=${data.receipt_token}`;

                if (paymentMethod === 'online') {
                    // Redirect to PayMongo's hosted checkout (QR Ph / GCash / Maya / Card)
                    const payRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/create-checkout-session/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': authTokens ? `Bearer ${authTokens.access}` : ''
                        },
                        body: JSON.stringify({ order_id: orderId })
                    });
                    if (payRes.ok) {
                        const payData = await payRes.json();
                        if (payData.checkout_url) {
                            window.location.href = payData.checkout_url;
                            return;
                        }
                    }
                    // The order exists; its receipt page offers "Pay now" to retry
                    navigate(`${receiptUrl}&cancelled=1`);
                } else {
                    navigate(receiptUrl);
                }
            } else {
                const errData = await res.json();
                setCheckoutError(errData.error || 'Failed to place the order.');
            }
        } catch (err) {
            console.error("Checkout error:", err);
            setCheckoutError('An error occurred during checkout. Please try again.');
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    // One product card, shared by the grid and the phone category rows
    const renderProductCard = (product, { className = '', showCategory = true } = {}) => {
        const isOutOfStock = product.stock_quantity <= 0;
        return (
            <div 
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={`group bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col ${className}`}
            >
                {/* Lifestyle Image with zoom effect */}
                <div className="relative aspect-square overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                    {getProductImage(product) ? (
                        <img
                            src={getProductImage(product)}
                            alt={product.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full bg-[#F1F5F9] flex flex-col items-center justify-center gap-2 p-4 text-center border-b border-slate-200">
                            <Leaf className="text-slate-400" size={28} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Image Coming Soon</span>
                        </div>
                    )}
                    {/* Tag category badge */}
                    {showCategory && <span className="absolute top-2 left-2 sm:top-3 sm:left-3 px-2 sm:px-2.5 py-1 bg-white/90 backdrop-blur-[4px] text-slate-800 text-[10px] font-black rounded-lg uppercase tracking-wider border border-slate-100 shadow-sm">
                        {product.category}
                    </span>}
                    
                    {/* Stock badge */}
                    {isOutOfStock ? (
                        <span className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-0.5 bg-red-100 text-red-800 text-[9px] font-black rounded uppercase">
                            Out of Stock
                        </span>
                    ) : product.stock_quantity < 10 ? (
                        <span className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded uppercase">
                            Only {product.stock_quantity} left
                        </span>
                    ) : null}
                </div>

                {/* Content info block */}
                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors mb-1 truncate">
                            {product.name}
                        </h3>
                        {product.review_count > 0 && (
                            <div className="flex items-center gap-1 mb-1 text-[11px] font-bold text-slate-600">
                                <Star size={11} className="text-amber-400" fill="currentColor" />
                                {product.avg_rating.toFixed(1)}
                                <span className="text-slate-400 font-semibold">({product.review_count})</span>
                            </div>
                        )}
                        <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed mb-3">
                            {product.description || "No description provided."}
                        </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unit Price</span>
                            <span className="text-[#059669] font-black text-sm">
                                ₱{parseFloat(product.unit_price).toLocaleString()}
                            </span>
                        </div>

                        {/* Add to Cart Action */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Avoid opening product modal
                                if (!isOutOfStock) {
                                    addToCart(product, 1);
                                }
                            }}
                            disabled={isOutOfStock}
                            className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 flex items-center justify-center border-none cursor-pointer disabled:opacity-50 disabled:hover:bg-emerald-50 disabled:hover:text-emerald-700 transition-colors"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Phones, "All Products" with nothing narrowed down: one swipe row per category
    // (shop-app style). Searching, filtering or picking a tab switches to the grid.
    const filtersActive = !!searchQuery || maxPrice < 6000 || selectedLights.size > 0 || selectedCares.size > 0 || selectedMaterials.size > 0;
    const showCategoryRows = isPhone && activeTab === 'All' && !filtersActive;
    const CATEGORY_ROWS = [
        { key: 'plant', label: 'Plants' },
        { key: 'furniture', label: 'Furniture' },
        { key: 'hardscape', label: 'Hardscape' },
    ];
    const openCategory = (key) => {
        setActiveTab(key);
        setSelectedLights(new Set());
        setSelectedCares(new Set());
        setSelectedMaterials(new Set());
        // Land on the top of the results, just under the sticky category tabs
        requestAnimationFrame(() => productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };

    return (
        <div className="min-h-screen bg-[#FFFFFF]" style={{ fontFamily: "'Inter', sans-serif" }}>
            
            {/* Header Banner */}
            <div className="relative bg-gradient-to-r from-[#064E3B] to-[#047857] text-white py-16 px-6 md:px-12 overflow-hidden shadow-sm">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FDFAF6_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div>
                        <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[11px] font-black tracking-widest uppercase px-3 py-1 rounded-full mb-3">
                            <Sparkles size={11} /> Premium Landscaping Inventory
                        </span>
                        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
                            The Garden Studio Shop
                        </h1>
                        <p className="text-slate-300 max-w-lg text-sm md:text-base font-medium leading-relaxed">
                            Curated high-quality tropical plants, sturdy outdoor teak furniture, and natural stone pathways to elevate your spatial layouts.
                        </p>
                    </div>
                    {/* View Cart Floating Trigger */}
                    <button 
                        onClick={() => setIsCartOpen(true)}
                        className="bg-white text-emerald-950 font-bold px-6 py-4 rounded-2xl flex items-center gap-3 shadow-lg hover:shadow-xl hover:bg-slate-50 transition-all border-none cursor-pointer"
                    >
                        <ShoppingCart size={20} className="text-emerald-700" />
                        <span>View Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
                        {cartSubtotal > 0 && (
                            <span className="bg-emerald-50 text-emerald-800 text-xs font-black px-2 py-0.5 rounded border border-emerald-200">
                                ₱{cartSubtotal.toLocaleString()}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Shop Category Navigation Tabs */}
            <div className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between overflow-x-auto gap-8">
                    <div className="flex gap-2 py-3.5 shrink-0">
                        {['All', 'plant', 'furniture', 'hardscape'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab);
                                    // Reset active category specific filters
                                    setSelectedLights(new Set());
                                    setSelectedCares(new Set());
                                    setSelectedMaterials(new Set());
                                }}
                                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer whitespace-nowrap ${
                                    activeTab === tab
                                        ? 'bg-[#059669] text-white shadow-sm'
                                        : 'text-slate-500 bg-transparent hover:bg-slate-100 hover:text-slate-800'
                                }`}
                            >
                                {tab === 'All' ? 'All Products' : tab + 's'}
                            </button>
                        ))}
                    </div>
                    {/* Tiny Cart Counter indicator */}
                    <div className="hidden sm:flex items-center gap-2 text-slate-500 font-semibold text-xs">
                        <ShoppingBag size={14} />
                        <span>{filteredProducts.length} items found</span>
                    </div>
                </div>
            </div>

            {/* Main Layout Container */}
            <div className="max-w-7xl mx-auto px-0 sm:px-6 py-6 sm:py-10 flex flex-col lg:flex-row gap-5 lg:gap-8">
                
                {/* 1. FILTER SIDEBAR */}
                <div className="w-full lg:w-[280px] shrink-0 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
                    <div className={`flex items-center justify-between ${filtersOpen ? 'pb-4 border-b border-slate-100 mb-6' : 'lg:pb-4 lg:border-b lg:border-slate-100 lg:mb-6'}`}>
                        {/* Phones/tablets: the heading opens and closes the panel */}
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(o => !o)}
                            aria-expanded={filtersOpen}
                            className="lg:hidden text-base font-extrabold text-slate-800 flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer"
                        >
                            <Filter size={16} className="text-emerald-700" />
                            Filters
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <h2 className="hidden lg:flex text-base font-extrabold text-slate-800 items-center gap-2">
                            <Filter size={16} className="text-emerald-700" />
                            Filters
                        </h2>
                        {(searchQuery || maxPrice < 6000 || selectedLights.size > 0 || selectedCares.size > 0 || selectedMaterials.size > 0) && (
                            <button 
                                onClick={() => {
                                    setSearchQuery('');
                                    setMaxPrice(6000);
                                    setSelectedLights(new Set());
                                    setSelectedCares(new Set());
                                    setSelectedMaterials(new Set());
                                }}
                                className="text-[10px] font-black text-emerald-600 bg-transparent border-none cursor-pointer hover:underline"
                            >
                                Reset All
                            </button>
                        )}
                    </div>

                    <div className={filtersOpen ? '' : 'hidden lg:block'}>
                    {/* Search Field */}
                    <div className="flex flex-col gap-2 mb-6">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Search Product</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name, tags..."
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
                            />
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>

                    {/* Price Slider */}
                    <div className="flex flex-col gap-2 mb-6">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                            <span>Max Budget</span>
                            <span className="text-emerald-700 font-extrabold text-xs">₱{maxPrice.toLocaleString()}</span>
                        </div>
                        <input
                            type="range"
                            min="100"
                            max="6000"
                            step="100"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(Number(e.target.value))}
                            className="w-full accent-emerald-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                            <span>₱100</span>
                            <span>₱6,000+</span>
                        </div>
                    </div>

                    {/* DYNAMIC CATEGORY FILTERS */}
                    
                    {/* Plants Category Filters */}
                    {(activeTab === 'All' || activeTab === 'plant') && (
                        <div className="border-t border-slate-100 pt-5 space-y-5">
                            {/* Light Requirement */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Light Requirement</h3>
                                <div className="flex flex-col gap-2">
                                    {['Full Sun', 'Partial Shade'].map(light => (
                                        <label key={light} className="flex items-center gap-2.5 text-xs text-slate-600 font-medium cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedLights.has(light)}
                                                onChange={() => toggleFilter(selectedLights, setSelectedLights, light)}
                                                className="rounded text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 w-4 h-4 cursor-pointer"
                                            />
                                            <span>{light}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Care Level */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Care Level</h3>
                                <div className="flex flex-col gap-2">
                                    {['Low Maintenance', 'Moderate Care'].map(care => (
                                        <label key={care} className="flex items-center gap-2.5 text-xs text-slate-600 font-medium cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedCares.has(care)}
                                                onChange={() => toggleFilter(selectedCares, setSelectedCares, care)}
                                                className="rounded text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 w-4 h-4 cursor-pointer"
                                            />
                                            <span>{care}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Furniture Category Filters */}
                    {(activeTab === 'All' || activeTab === 'furniture') && (
                        <div className="border-t border-slate-100 pt-5">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Furniture Material</h3>
                            <div className="flex flex-col gap-2">
                                {['Teak Wood', 'Metal'].map(material => (
                                    <label key={material} className="flex items-center gap-2.5 text-xs text-slate-600 font-medium cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedMaterials.has(material)}
                                            onChange={() => toggleFilter(selectedMaterials, setSelectedMaterials, material)}
                                            className="rounded text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 w-4 h-4 cursor-pointer"
                                        />
                                        <span>{material}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hardscape Category Filters */}
                    {(activeTab === 'All' || activeTab === 'hardscape') && (
                        <div className="border-t border-slate-100 pt-5">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">Hardscape Material</h3>
                            <div className="flex flex-col gap-2">
                                {['Natural Stone', 'Galvanized Steel'].map(material => (
                                    <label key={material} className="flex items-center gap-2.5 text-xs text-slate-600 font-medium cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedMaterials.has(material)}
                                            onChange={() => toggleFilter(selectedMaterials, setSelectedMaterials, material)}
                                            className="rounded text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 w-4 h-4 cursor-pointer"
                                        />
                                        <span>{material}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    </div>
                </div>

                {/* 2. PRODUCT EXPERIENCE GRID */}
                <div ref={productsRef} className="flex-1 min-w-0 scroll-mt-20">
                    
                    {loading ? (
                        <div className="py-20 text-center text-slate-400 font-medium">
                            Loading garden products...
                        </div>
                    ) : error ? (
                        <div className="py-20 text-center text-red-500 font-medium bg-red-50 border border-red-100 rounded-3xl p-6">
                            {error}
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 font-medium bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-6">
                            No products match your search or filter settings. Try adjusting filters.
                        </div>
                    ) : showCategoryRows ? (
                        <div className="flex flex-col gap-7">
                            {CATEGORY_ROWS.map(({ key, label }) => {
                                const items = filteredProducts.filter(p => p.category === key);
                                if (!items.length) return null;
                                return (
                                    <section key={key} aria-label={label}>
                                        <div className="flex items-center justify-between mb-3">
                                            <h2 className="text-base font-extrabold text-slate-900 m-0">
                                                {label} <span className="text-slate-400 font-semibold text-sm">({items.length})</span>
                                            </h2>
                                            <button
                                                type="button"
                                                onClick={() => openCategory(key)}
                                                className="flex items-center gap-1 text-[13px] font-bold text-emerald-700 bg-transparent border-none cursor-pointer p-1"
                                            >
                                                See all <ArrowRight size={14} />
                                            </button>
                                        </div>
                                        {/* Bleeds to the screen edges; ~2.3 cards visible so the next one peeks in */}
                                        <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 pt-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                            {items.map(product => renderProductCard(product, { className: 'w-[42%] shrink-0 snap-start', showCategory: false }))}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                            {filteredProducts.map(product => renderProductCard(product))}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. PRODUCT SPECIFICATIONS DETAIL MODAL */}
            {selectedProduct && (() => {
                const meta = PRODUCT_METADATA[selectedProduct.name] || {};
                const imgUrl = meta.unsplashUrl || DEFAULT_LIFESTYLE_IMAGE;
                const isOutOfStock = selectedProduct.stock_quantity <= 0;

                return (
                    <div 
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                        style={{ background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(8px)' }}
                        onClick={() => setSelectedProduct(null)}
                    >
                        <div 
                            className="bg-white rounded-[24px] border border-slate-200 overflow-hidden w-full max-w-[800px] shadow-2xl relative flex flex-col md:flex-row max-h-[90vh]"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Close Button */}
                            <button 
                                onClick={() => setSelectedProduct(null)}
                                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer bg-transparent border-none z-10"
                            >
                                <X size={20} />
                            </button>

                            {/* Left Col: Lifestyle Image */}
                            <div className="w-full md:w-[45%] bg-[#F1F5F9] relative min-h-[250px] md:min-h-0 flex items-center justify-center">
                                {getProductImage(selectedProduct) ? (
                                    <img
                                        src={getProductImage(selectedProduct)}
                                        alt={selectedProduct.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center min-h-[250px]">
                                        <Leaf className="text-slate-400" size={32} />
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Image Coming Soon</span>
                                    </div>
                                )}
                                <span className="absolute top-4 left-4 px-2.5 py-1 bg-white/90 backdrop-blur-[4px] text-slate-800 text-[10px] font-black rounded-lg uppercase tracking-wider border border-slate-100 shadow-sm">
                                    {selectedProduct.category}
                                </span>
                            </div>

                            {/* Right Col: Details + Specs */}
                            <div className="w-full md:w-[55%] p-6 md:p-8 overflow-y-auto max-h-[60vh] md:max-h-[90vh] flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-1 leading-tight">
                                            {selectedProduct.name}
                                        </h3>
                                        <span className="text-[#059669] font-black text-lg">
                                            ₱{parseFloat(selectedProduct.unit_price).toLocaleString()}
                                        </span>
                                        {selectedProduct.review_count > 0 && (
                                            <div className="flex items-center gap-1 mt-1 text-xs font-bold text-slate-600">
                                                {[1, 2, 3, 4, 5].map(n => (
                                                    <Star key={n} size={13}
                                                        className={n <= Math.round(selectedProduct.avg_rating) ? 'text-amber-400' : 'text-slate-200'}
                                                        fill="currentColor" />
                                                ))}
                                                <span className="ml-1">{selectedProduct.avg_rating.toFixed(1)}</span>
                                                <span className="text-slate-400 font-semibold">
                                                    · {selectedProduct.review_count} review{selectedProduct.review_count > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Description</h4>
                                        <p className="text-slate-600 text-xs leading-relaxed font-medium">
                                            {selectedProduct.description || "No description provided."}
                                        </p>
                                    </div>

                                    {/* Specifications Section */}
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-3">
                                        <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                                            <Info size={12} className="text-emerald-700" />
                                            Specifications
                                        </h4>
                                        
                                        <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                                            <div>
                                                <span className="text-slate-400 font-bold block text-[10px] uppercase">Dimensions</span>
                                                <span className="text-slate-800 font-semibold">{meta.dimensions || "Standard size"}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 font-bold block text-[10px] uppercase">Material</span>
                                                <span className="text-slate-800 font-semibold">{meta.material || "Natural"}</span>
                                            </div>
                                            {selectedProduct.category === 'plant' && (
                                                <>
                                                    <div>
                                                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Light Needs</span>
                                                        <span className="text-slate-800 font-semibold">{meta.light || "Full Sun"}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Care Level</span>
                                                        <span className="text-slate-800 font-semibold">{meta.care || "Low Maintenance"}</span>
                                                    </div>
                                                </>
                                            )}
                                            {selectedProduct.spacing_cm && (
                                                <div>
                                                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Plant Spacing</span>
                                                    <span className="text-slate-800 font-semibold">{selectedProduct.spacing_cm} cm OC</span>
                                                </div>
                                            )}
                                        </div>

                                        {meta.careInstructions && (
                                            <div className="pt-2 border-t border-slate-200/60">
                                                <span className="text-slate-400 font-bold block text-[10px] uppercase mb-1">Care & Setup instructions</span>
                                                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                                    {meta.careInstructions}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Customer Reviews */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Customer Reviews</h4>
                                        {productReviews === null ? (
                                            <p className="text-[11px] text-slate-400 font-medium">Loading reviews…</p>
                                        ) : productReviews.length === 0 ? (
                                            <p className="text-[11px] text-slate-400 font-medium">No reviews yet. Customers can rate this item once their order is delivered.</p>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {productReviews.map(r => (
                                                    <div key={r.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[11px] font-bold text-slate-800">{r.reviewer_name}</span>
                                                            <span className="flex gap-0.5">
                                                                {[1, 2, 3, 4, 5].map(n => (
                                                                    <Star key={n} size={10}
                                                                        className={n <= r.rating ? 'text-amber-400' : 'text-slate-200'}
                                                                        fill="currentColor" />
                                                                ))}
                                                            </span>
                                                        </div>
                                                        {r.comment && (
                                                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium m-0">{r.comment}</p>
                                                        )}
                                                        <span className="text-[10px] text-slate-400 font-semibold">
                                                            Verified purchase · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </span>
                                                        {r.reply && (
                                                            <div className="mt-2 pl-2.5 border-l-2 border-emerald-400">
                                                                <p className="text-[10px] font-bold text-emerald-700 m-0">Response from Garden Studio</p>
                                                                <p className="text-[11px] text-slate-600 leading-relaxed m-0">{r.reply}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-6 pt-4 border-t border-slate-100 flex gap-4">
                                    <button
                                        onClick={() => {
                                            if (!isOutOfStock) {
                                                addToCart(selectedProduct, 1);
                                                setSelectedProduct(null);
                                                setIsCartOpen(true);
                                            }
                                        }}
                                        disabled={isOutOfStock}
                                        className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <ShoppingCart size={14} />
                                        {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* 4. SHOPPING CART DRAWER */}
            {isCartOpen && (
                <div 
                    className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex justify-end"
                    onClick={() => setIsCartOpen(false)}
                >
                    <div 
                        className="bg-white w-full max-w-[450px] h-full shadow-2xl flex flex-col justify-between"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-2.5">
                                <ShoppingCart size={20} className="text-emerald-700" />
                                <h3 className="font-extrabold text-slate-800 text-base">Shopping Cart</h3>
                                <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2 py-0.5 rounded-full">
                                    {cart.reduce((s, i) => s + i.quantity, 0)}
                                </span>
                            </div>
                            <button 
                                onClick={() => setIsCartOpen(false)}
                                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors bg-transparent border-none cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Body (Items list) */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-10">
                                    <ShoppingBag size={48} className="text-slate-300 mb-3" />
                                    <p className="font-bold text-sm">Your cart is empty</p>
                                    <p className="text-xs max-w-[200px] mt-1 text-slate-400">Add plants or hardscapes to start organizing your garden layout.</p>
                                </div>
                            ) : (
                                cart.map(c => {
                                    return (
                                        <div key={c.product.id} className="flex gap-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl relative group">
                                            {/* Thumbnail */}
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                                                {getProductImage(c.product) ? (
                                                    <img 
                                                        src={getProductImage(c.product)} 
                                                        alt={c.product.name} 
                                                        loading="lazy"
                                                        className="w-full h-full object-cover" 
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-[#F1F5F9] flex items-center justify-center text-slate-400">
                                                        <Leaf size={16} />
                                                    </div>
                                                )}
                                            </div>
                                            {/* Details */}
                                            <div className="flex-1 flex flex-col justify-between">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-xs line-clamp-1">{c.product.name}</h4>
                                                    <span className="text-[#059669] font-black text-xs block mt-0.5">
                                                        ₱{parseFloat(c.product.unit_price).toLocaleString()}
                                                    </span>
                                                </div>
                                                {/* Quantity Controls */}
                                                <div className="flex items-center gap-2 mt-1">
                                                    <button 
                                                        onClick={() => updateQuantity(c.product.id, c.quantity - 1)}
                                                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer"
                                                    >
                                                        <Minus size={10} />
                                                    </button>
                                                    <span className="text-xs font-bold text-slate-800 w-4 text-center">{c.quantity}</span>
                                                    <button 
                                                        onClick={() => updateQuantity(c.product.id, c.quantity + 1)}
                                                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer"
                                                    >
                                                        <Plus size={10} />
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Delete */}
                                            <button 
                                                onClick={() => removeFromCart(c.product.id)}
                                                className="absolute top-3 right-3 p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors bg-transparent border-none cursor-pointer"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Drawer Footer (Pricing summaries) */}
                        {cart.length > 0 && (
                            <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-4">
                                <div className="space-y-1.5 text-xs text-slate-500">
                                    <div className="flex justify-between font-medium">
                                        <span>Subtotal</span>
                                        <span className="font-bold text-slate-800">₱{cartSubtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between font-medium">
                                        <span>Shipping Fee (Bulky Flat Rate)</span>
                                        <span className="font-bold text-slate-800">₱{shippingFee.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-slate-200 text-slate-800">
                                        <span>Grand Total</span>
                                        <span className="text-emerald-700 text-base font-black">₱{grandTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsCartOpen(false);
                                        setIsCheckoutOpen(true);
                                    }}
                                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl border-none cursor-pointer transition-colors shadow-md flex items-center justify-center gap-2"
                                >
                                    Proceed to Checkout
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 5. CHECKOUT FLOW WIZARD OVERLAY */}
            {isCheckoutOpen && (
                <div 
                    className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setIsCheckoutOpen(false)}
                >
                    <div 
                        className="bg-white rounded-[24px] border border-slate-200 overflow-hidden w-full max-w-[850px] shadow-2xl relative flex flex-col md:flex-row max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button 
                            onClick={() => setIsCheckoutOpen(false)}
                            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer bg-transparent border-none z-10"
                        >
                            <X size={20} />
                        </button>

                        {/* Left Col: Customer Shipping Form */}
                        <div className="w-full md:w-[55%] p-6 md:p-8 overflow-y-auto max-h-[50vh] md:max-h-[90vh]">
                            <h3 className="text-lg md:text-xl font-extrabold text-slate-900 flex items-center gap-2 mb-2">
                                <CreditCard style={{ color: '#059669' }} size={22} />
                                Checkout Details
                            </h3>
                            <p className="text-slate-500 text-xs font-semibold mb-6">
                                Enter your delivery details and choose your preferred payment method.
                            </p>

                            {checkoutError && (
                                <div className="p-3 mb-4 rounded-xl text-xs font-bold bg-red-50 border border-red-100 text-red-700 flex items-center gap-2">
                                    <X size={14} />
                                    <span>{checkoutError}</span>
                                </div>
                            )}

                            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                                {/* Name */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Customer Name</label>
                                    <input
                                        type="text"
                                        value={checkoutForm.name}
                                        onChange={(e) => setCheckoutForm({...checkoutForm, name: e.target.value})}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 outline-none"
                                        required
                                    />
                                </div>

                                {/* Email */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Customer Email</label>
                                    <input
                                        type="email"
                                        value={checkoutForm.email}
                                        onChange={(e) => setCheckoutForm({...checkoutForm, email: e.target.value})}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 outline-none"
                                        required
                                    />
                                </div>

                                {/* Phone */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Contact Number</label>
                                    <input
                                        type="tel"
                                        value={checkoutForm.phone}
                                        onChange={(e) => setCheckoutForm({...checkoutForm, phone: e.target.value})}
                                        placeholder="e.g. 09171234567"
                                        inputMode="tel"
                                        className={`w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-medium outline-none ${
                                            phoneInvalid ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-emerald-500'
                                        }`}
                                        required
                                    />
                                    {phoneInvalid && (
                                        <span className="text-[10px] font-medium text-red-600">{PHONE_HINT}</span>
                                    )}
                                </div>

                                {/* Address */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Delivery Address</label>
                                    <textarea
                                        value={checkoutForm.address}
                                        onChange={(e) => setCheckoutForm({...checkoutForm, address: e.target.value})}
                                        rows={2.5}
                                        placeholder="Full address where items will be delivered"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 outline-none resize-none"
                                        required
                                    />
                                </div>

                                {/* Payment Method Options */}
                                <div className="pt-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Payment Method</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className={`border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                                            paymentMethod === 'online' ? 'border-emerald-600 bg-emerald-50/40 text-emerald-800' : 'border-slate-200 hover:bg-slate-50'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="payment"
                                                value="online"
                                                checked={paymentMethod === 'online'}
                                                onChange={() => setPaymentMethod('online')}
                                                className="sr-only"
                                            />
                                            <CreditCard size={20} className={paymentMethod === 'online' ? 'text-emerald-700' : 'text-slate-400'} />
                                            <span className="text-xs font-bold text-center">Online Payment</span>
                                            <span className="text-[9px] text-slate-400 text-center font-medium">QR Ph / GCash / Maya / Card</span>
                                        </label>

                                        <label className={`border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                                            codBlocked ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                                            : paymentMethod === 'cod' ? 'border-emerald-600 bg-emerald-50/40 text-emerald-800 cursor-pointer' : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="payment"
                                                value="cod"
                                                checked={paymentMethod === 'cod'}
                                                onChange={() => setPaymentMethod('cod')}
                                                disabled={!!codBlocked}
                                                className="sr-only"
                                            />
                                            <DollarSign size={20} className={paymentMethod === 'cod' ? 'text-emerald-700' : 'text-slate-400'} />
                                            <span className="text-xs font-bold text-center">Cash on Delivery</span>
                                            <span className={`text-[9px] text-center font-medium ${codBlocked ? 'text-amber-700' : 'text-slate-400'}`}>
                                                {codBlocked || 'Pay upon delivery'}
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmittingOrder}
                                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md transition-all mt-4"
                                >
                                    {isSubmittingOrder ? 'Processing Order...' : paymentMethod === 'online' ? 'Pay Now & Complete Order' : 'Confirm Order (COD)'}
                                </button>
                            </form>
                        </div>

                        {/* Right Col: Order Summary Breakdown */}
                        <div className="w-full md:w-[45%] bg-[#F9FAFB] p-6 md:p-8 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col justify-between overflow-y-auto max-h-[40vh] md:max-h-[90vh]">
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Order Summary</h4>
                                
                                {/* Items list mini */}
                                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 border-b border-slate-200 pb-4 mb-4">
                                    {cart.map(c => (
                                        <div key={c.product.id} className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium line-clamp-1 flex-1 pr-4">
                                                {c.product.name} <span className="text-slate-400 font-bold">x{c.quantity}</span>
                                            </span>
                                            <span className="font-semibold text-slate-800 shrink-0">
                                                ₱{(parseFloat(c.product.unit_price) * c.quantity).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Costs Breakdown */}
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Subtotal</span>
                                        <span className="font-semibold text-slate-800">₱{cartSubtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>Shipping Fee (Bulky items)</span>
                                        <span className="font-semibold text-slate-800">₱{shippingFee.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-slate-200 text-slate-800">
                                        <span>Grand Total</span>
                                        <span className="text-emerald-700 text-base font-black">₱{grandTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Trust badges */}
                            <div className="mt-8 pt-4 border-t border-slate-200 space-y-3">
                                <div className="flex gap-2.5 items-start">
                                    <Shield size={16} className="text-emerald-700 shrink-0" />
                                    <div>
                                        <div className="font-bold text-[10px] uppercase text-slate-700">Safe & Secure checkout</div>
                                        <div className="text-[10px] text-slate-400 leading-normal font-medium">You pay on PayMongo's secure page. We never see your card or e-wallet details.</div>
                                    </div>
                                </div>
                                <div className="flex gap-2.5 items-start">
                                    <MapPin size={16} className="text-emerald-700 shrink-0" />
                                    <div>
                                        <div className="font-bold text-[10px] uppercase text-slate-700">Reliable local courier</div>
                                        <div className="text-[10px] text-slate-400 leading-normal font-medium">Delivered directly by Garden Studio crew to ensure item handling quality.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
