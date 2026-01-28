'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Save, X, Trash2, Settings, List, Printer, FileText, Search, Calendar, Filter, ArrowDown, Briefcase, DollarSign, StopCircle, RefreshCw, Calculator } from 'lucide-react';

// Type definition based on the view we created
type AssetReportRow = {
  id: number;
  asset_code: string;
  name: string;
  purchase_date: string; // Added
  start_depreciation_date: string; // Added
  opening_balance: number;
  additions: number;
  disposals: number;
  book_balance_end: number;
  depreciation_rate: number;
  depreciation_duration: number;
  accum_dep_opening: number;
  period_depreciation: number;
  accum_dep_closing: number;
  net_book_value: number;
};

// Form state for Add/Edit Asset
type AssetForm = {
  id?: number;
  asset_code: string;
  name: string;
  purchase_date: string;
  start_depreciation_date: string;
  initial_cost: number;
  salvage_value: number;
  useful_life_months: number;
  depreciation_rate: number;
  opening_accum_depreciation: number;
};

const INITIAL_FORM: AssetForm = {
  asset_code: '',
  name: '',
  purchase_date: new Date().toISOString().split('T')[0],
  start_depreciation_date: new Date().toISOString().split('T')[0],
  initial_cost: 0,
  salvage_value: 0,
  useful_life_months: 60,
  depreciation_rate: 20,
  opening_accum_depreciation: 0
};

export default function AnnualDepreciationReport() {
  const [data, setData] = useState<AssetReportRow[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  // Form States
  const [editingAsset, setEditingAsset] = useState<AssetForm | null>(null);
  const [formData, setFormData] = useState<AssetForm>(INITIAL_FORM);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-12-31`;
  });

  // Category Form State
  const [newCategory, setNewCategory] = useState({ name: '', life_years: 5, rate: 20 });

  // Fetch Data
  async function fetchData() {
    setLoading(true);
    try {
      // Fetch categories
      const { data: cats } = await supabase.from('asset_categories').select('*');
      if (cats) {
        setCategories(cats);
        // Set default category if available and none selected
        if (cats.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(cats[0].id);
        }
      }

      // Fetch Report Data using RPC (Dynamic Date Range)
      const { data: realData, error } = await supabase.rpc('get_asset_report_v2', { 
        p_start_date: startDate, 
        p_end_date: endDate 
      });
      
      if (error) {
        console.error('Error fetching data (RPC):', error);
        // Fallback to View if RPC fails (e.g., function not created yet)
        const { data: viewData, error: viewError } = await supabase.from('asset_movement_report').select('*').order('asset_code', { ascending: true });
        if (viewError) {
            console.error('Error fetching data (View):', viewError);
        } else {
            setData(viewData || []);
        }
      } else {
        setData(realData || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]); // Refetch when dates change

  // Handle Asset Submit (Add or Edit)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        asset_code: formData.asset_code,
        name: formData.name,
        purchase_date: formData.purchase_date,
        start_depreciation_date: formData.start_depreciation_date,
        initial_cost: formData.initial_cost,
        salvage_value: formData.salvage_value,
        useful_life_months: formData.useful_life_months,
        depreciation_rate: formData.depreciation_rate,
        opening_accum_depreciation: formData.opening_accum_depreciation,
        category_id: selectedCategoryId
      };

      if (!selectedCategoryId) {
        alert('يجب اختيار تصنيف للأصل أولاً');
        setLoading(false);
        return;
      }

      if (editingAsset?.id) {
        // Update
        const { error } = await supabase
          .from('assets')
          .update(payload)
          .eq('id', editingAsset.id);
        
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('assets')
          .insert([payload]);
        
        if (error) throw error;
      }

      // Close and Refresh
      setIsModalOpen(false);
      setEditingAsset(null);
      setFormData(INITIAL_FORM);
      fetchData();

    } catch (error: any) {
      alert('حدث خطأ أثناء الحفظ: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle Category Submit
  async function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('asset_categories').insert([{
        name: newCategory.name,
        useful_life_years: newCategory.life_years,
        annual_depreciation_rate: newCategory.rate
      }]);

      if (error) throw error;

      alert('تم إضافة التصنيف بنجاح');
      setNewCategory({ name: '', life_years: 5, rate: 20 });
      fetchData(); // Refresh categories list
      setIsCategoryModalOpen(false);
    } catch (error: any) {
      alert('خطأ في إضافة التصنيف: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Open Modal for Edit
  async function handleEditClick(row: AssetReportRow) {
    const { data: assetData } = await supabase
      .from('assets')
      .select('*')
      .eq('id', row.id)
      .single();

    if (assetData) {
      setEditingAsset(assetData);
      setFormData(assetData);
      setSelectedCategoryId(assetData.category_id);
      setIsModalOpen(true);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('هل أنت متأكد من حذف هذا الأصل؟')) return;
    
    setLoading(true);
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) alert('خطأ في الحذف');
    else fetchData();
    setLoading(false);
  }

  // Auto-calculate rate based on life years (helper for category form)
  useEffect(() => {
    if (newCategory.life_years > 0) {
      const rate = parseFloat((100 / newCategory.life_years).toFixed(2));
      setNewCategory(prev => ({ ...prev, rate }));
    }
  }, [newCategory.life_years]);

  const handlePrint = () => {
    window.print();
  };

  const filteredData = data.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.asset_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-right" dir="rtl">
      
      {/* Header & Actions - Hidden in Print */}
      <header className="print:hidden mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <List className="w-8 h-8" />
              </div>
              تقرير إهلاك الأصول الثابتة
            </h1>
            <p className="text-slate-500 mr-14">الإدارة والتحكم الكامل في سجل الأصول والإهلاكات السنوية</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
             <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-xl transition-all font-medium shadow-sm"
            >
              <Printer size={18} />
              طباعة
            </button>

            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-xl transition-all font-medium shadow-sm"
            >
              <Settings size={18} />
              التصنيفات
            </button>
            
            <button 
              onClick={() => {
                setEditingAsset(null);
                setFormData(INITIAL_FORM);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/20 font-medium"
            >
              <Plus size={20} />
              أصل جديد
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Filter size={18} className="text-blue-600" />
                <span>نطاق التقرير:</span>
            </div>
            
            <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex-1">
                    <span className="text-xs text-slate-400">من:</span>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="outline-none text-sm text-slate-700 w-full bg-transparent"
                    />
                </div>
                <ArrowDown size={16} className="text-slate-300 transform rotate-[-90deg] md:rotate-0" />
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex-1">
                    <span className="text-xs text-slate-400">إلى:</span>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="outline-none text-sm text-slate-700 w-full bg-transparent"
                    />
                </div>
            </div>

            <div className="h-8 w-px bg-slate-200 hidden md:block mx-2"></div>

            <div className="relative w-full md:w-64">
                <input
                  type="text"
                  placeholder="بحث باسم الأصل أو الرمز..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm text-sm"
                />
                <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
            </div>
        </div>
      </header>

      {/* Print Header - Visible only in Print */}
      <div className="hidden print:block mb-8 text-center border-b-2 border-black pb-4">
        <h1 className="text-4xl font-bold mb-2">تقرير سجل الأصول والإهلاكات</h1>
        <p className="text-xl text-gray-600">للفترة من {startDate} إلى {endDate}</p>
      </div>

      {/* Stats Cards - Hidden in Print */}
      <div className="print:hidden grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard title="إجمالي تكلفة الأصول" value={formatMoney(filteredData.reduce((a, b) => a + b.book_balance_end, 0))} color="blue" />
        <StatCard title="إجمالي مجمع الإهلاك" value={formatMoney(filteredData.reduce((a, b) => a + b.accum_dep_closing, 0))} color="amber" />
        <StatCard title="صافي القيمة الدفترية" value={formatMoney(filteredData.reduce((a, b) => a + b.net_book_value, 0))} color="emerald" />
        <StatCard title="عدد الأصول المسجلة" value={filteredData.length} color="slate" isNumber />
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden print:shadow-none print:border-none print:rounded-none">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm text-right min-w-[1400px] border-collapse">
            <thead className="sticky top-0 z-20 shadow-md">
              {/* Top Header Level */}
              <tr className="bg-slate-900 text-white text-center">
                <th rowSpan={2} className="p-4 font-semibold w-24 print:hidden">الإجراءات</th>
                <th rowSpan={2} className="p-4 font-semibold w-32">رمز الحساب</th>
                <th rowSpan={2} className="p-4 font-semibold min-w-[200px]">اسم الأصل</th>
                <th rowSpan={2} className="p-2 font-semibold w-24 text-xs">تاريخ<br/>الشراء</th>
                <th rowSpan={2} className="p-2 font-semibold w-24 text-xs">بداية<br/>الإهلاك</th>
                <th colSpan={4} className="p-2 bg-blue-950/50 backdrop-blur-sm border-b border-blue-800">حركة التكلفة (Cost)</th>
                <th colSpan={2} className="p-2 bg-amber-950/50 backdrop-blur-sm border-b border-amber-800">معايير الإهلاك</th>
                <th colSpan={4} className="p-2 bg-indigo-950/50 backdrop-blur-sm border-b border-indigo-800">حركة الإهلاك المجمع</th>
                <th rowSpan={2} className="p-4 font-bold bg-emerald-900 w-32 shadow-inner">صافي القيمة<br/><span className="text-xs font-normal opacity-80">31/12/2025</span></th>
              </tr>
              {/* Sub Header Level */}
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wide text-center shadow-sm">
                <th className="p-3 bg-blue-50/80">رصيد افتتاحي</th>
                <th className="p-3 text-blue-700 bg-blue-50/80">إضافات</th>
                <th className="p-3 text-red-700 bg-blue-50/80">استبعادات</th>
                <th className="p-3 bg-blue-100 text-slate-900 border-l border-blue-200">الرصيد الدفتري</th>
                
                <th className="p-3 bg-amber-50/80">نسبة %</th>
                <th className="p-3 bg-amber-50/80 border-l border-amber-200">المدة</th>
                
                <th className="p-3 bg-indigo-50/80">مجمع افتتاحي</th>
                <th className="p-3 text-amber-700 bg-indigo-50/80">إهلاك الفترة</th>
                <th className="p-3 bg-indigo-50/80">إهلاك الإضافات</th>
                <th className="p-3 bg-indigo-100 text-slate-900 border-l border-indigo-200">مجمع الإهلاك</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && data.length === 0 ? (
                <tr><td colSpan={16} className="text-center p-12 text-slate-500">جاري تحميل البيانات...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center p-16">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      {searchQuery ? (
                         <>
                           <Search size={48} className="mb-4 opacity-50" />
                           <p className="text-lg font-medium text-slate-600 mb-2">لا توجد نتائج للبحث "{searchQuery}"</p>
                           <button onClick={() => setSearchQuery('')} className="text-blue-600 hover:underline">مسح البحث</button>
                         </>
                      ) : (
                        <>
                          <FileText size={48} className="mb-4 opacity-50" />
                          <p className="text-lg font-medium text-slate-600 mb-2">لا توجد أصول مسجلة حتى الآن</p>
                          <button 
                            onClick={() => { setEditingAsset(null); setFormData(INITIAL_FORM); setIsModalOpen(true); }}
                            className="text-blue-600 hover:text-blue-700 underline"
                          >
                            إضافة أول أصل
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, index) => (
                  <tr key={index} className="hover:bg-blue-50/50 transition-colors group even:bg-slate-50/40">
                    <td className="p-4 text-center print:hidden relative">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 items-center bg-white/50 backdrop-blur-[1px]">
                        <button onClick={() => handleEditClick(row)} className="p-1.5 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 shadow-sm" title="تعديل">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50 shadow-sm" title="حذف">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono text-slate-500 text-xs">{row.asset_code}</td>
                    <td className="p-4 font-semibold text-slate-800">{row.name}</td>
                    <td className="p-2 text-center font-mono text-xs text-slate-500">{row.purchase_date}</td>
                    <td className="p-2 text-center font-mono text-xs text-slate-500">{row.start_depreciation_date}</td>
                    
                    <td className="p-4 text-center font-mono text-slate-600">{formatMoney(row.opening_balance)}</td>
                    <td className="p-4 text-center font-mono text-blue-600 font-medium">{row.additions > 0 ? formatMoney(row.additions) : '-'}</td>
                    <td className="p-4 text-center font-mono text-red-600 font-medium">{row.disposals > 0 ? formatMoney(row.disposals) : '-'}</td>
                    <td className="p-4 text-center font-mono font-bold text-slate-900 bg-slate-50/50">{formatMoney(row.book_balance_end)}</td>
                    
                    <td className="p-4 text-center font-mono text-slate-500">{row.depreciation_rate}%</td>
                    <td className="p-4 text-center font-mono text-slate-500">{row.depreciation_duration}</td>
                    
                    <td className="p-4 text-center font-mono text-slate-600">{formatMoney(row.accum_dep_opening)}</td>
                    <td className="p-4 text-center font-mono text-amber-600 font-medium">{formatMoney(row.period_depreciation)}</td>
                    <td className="p-4 text-center font-mono text-slate-400">-</td>
                    <td className="p-4 text-center font-mono font-bold text-slate-900 bg-slate-50/50">{formatMoney(row.accum_dep_closing)}</td>
                    
                    <td className="p-4 text-center font-mono font-bold text-emerald-700 bg-emerald-50/30 border-r-4 border-r-emerald-500">
                      {formatMoney(row.net_book_value)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot className="bg-slate-900 text-white font-bold text-center border-t-4 border-slate-900 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <tr>
                  <td colSpan={5} className="p-4 text-right pr-8 text-lg">الإجمالي العام</td>
                  <td className="p-3 font-mono text-slate-300">{formatMoney(filteredData.reduce((a, b) => a + b.opening_balance, 0))}</td>
                  <td className="p-3 font-mono text-blue-300">{formatMoney(filteredData.reduce((a, b) => a + b.additions, 0))}</td>
                  <td className="p-3 font-mono text-red-300">{formatMoney(filteredData.reduce((a, b) => a + b.disposals, 0))}</td>
                  <td className="p-3 font-mono text-white text-lg bg-white/10">{formatMoney(filteredData.reduce((a, b) => a + b.book_balance_end, 0))}</td>
                  <td colSpan={2} className=""></td>
                  <td className="p-3 font-mono text-slate-300">{formatMoney(filteredData.reduce((a, b) => a + b.accum_dep_opening, 0))}</td>
                  <td className="p-3 font-mono text-amber-300">{formatMoney(filteredData.reduce((a, b) => a + b.period_depreciation, 0))}</td>
                  <td className="p-3 font-mono">0.00</td>
                  <td className="p-3 font-mono text-white text-lg bg-white/10">{formatMoney(filteredData.reduce((a, b) => a + b.accum_dep_closing, 0))}</td>
                  <td className="p-3 font-mono bg-emerald-800 text-emerald-300 text-lg">{formatMoney(filteredData.reduce((a, b) => a + b.net_book_value, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Advanced Operations Bar - Fixed Bottom (or just below table) */}
      <div className="print:hidden mt-8 p-6 bg-slate-900 rounded-2xl shadow-lg text-white">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Calculator size={20} className="text-amber-400" />
            عمليات محاسبية متقدمة
        </h3>
        <div className="flex flex-wrap gap-4">
            <button className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700">
                <DollarSign size={18} className="text-emerald-400" />
                <span>إعادة تقييم أصل</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700">
                <StopCircle size={18} className="text-red-400" />
                <span>إيقاف إهلاك مؤقت</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700">
                <RefreshCw size={18} className="text-blue-400" />
                <span>نقل أصل (مناقلة)</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700">
                <FileText size={18} className="text-purple-400" />
                <span>تسوية جردية</span>
            </button>
        </div>
      </div>

      {/* Asset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all scale-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${editingAsset ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {editingAsset ? <Edit size={24} /> : <Plus size={24} />}
                </div>
                {editingAsset ? 'تعديل بيانات الأصل' : 'تسجيل أصل جديد'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-100">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Category Selection */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-sm font-semibold text-slate-700 mb-2">تصنيف الأصل <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  <select 
                    required 
                    className="flex-1 p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                    value={selectedCategoryId || ''} 
                    onChange={e => setSelectedCategoryId(Number(e.target.value))}
                  >
                    <option value="" disabled>اختر التصنيف...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => { setIsModalOpen(false); setIsCategoryModalOpen(true); }}
                    className="p-3 bg-white border border-slate-300 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
                    title="إضافة تصنيف جديد"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم الأصل <span className="text-red-500">*</span></label>
                  <input 
                    required 
                    type="text" 
                    className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="مثال: جهاز لابتوب HP Pavilion 15"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">رمز الحساب <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      type="text" 
                      className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-left dir-ltr"
                      value={formData.asset_code} 
                      onChange={e => setFormData({...formData, asset_code: e.target.value})} 
                      placeholder="ACC-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">تكلفة الشراء <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono pl-12"
                        value={formData.initial_cost} 
                        onChange={e => setFormData({...formData, initial_cost: parseFloat(e.target.value)})} 
                      />
                      <span className="absolute left-3 top-3.5 text-slate-400 text-sm font-bold bg-slate-100 px-2 rounded">SAR</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الشراء <span className="text-red-500">*</span></label>
                  <input 
                    required 
                    type="date" 
                    className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    value={formData.purchase_date} 
                    onChange={e => setFormData({...formData, purchase_date: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ بدء الإهلاك <span className="text-red-500">*</span></label>
                  <input 
                    required 
                    type="date" 
                    className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    value={formData.start_depreciation_date} 
                    onChange={e => setFormData({...formData, start_depreciation_date: e.target.value})} 
                  />
                </div>
              </div>

              {/* Depreciation Params */}
              <div className="bg-blue-50/50 p-5 rounded-xl space-y-5 border border-blue-100">
                <h3 className="font-bold text-blue-900 text-base flex items-center gap-2">
                  <Settings size={18} />
                  إعدادات الإهلاك
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">نسبة الإهلاك السنوي (%) <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      className="w-full p-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      value={formData.depreciation_rate} 
                      onChange={e => setFormData({...formData, depreciation_rate: parseFloat(e.target.value)})} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">العمر الإنتاجي (شهور) <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      type="number" 
                      className="w-full p-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      value={formData.useful_life_months} 
                      onChange={e => setFormData({...formData, useful_life_months: parseInt(e.target.value)})} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">القيمة التخريدية (Salvage Value)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full p-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      value={formData.salvage_value} 
                      onChange={e => setFormData({...formData, salvage_value: parseFloat(e.target.value)})} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">مجمع الإهلاك الافتتاحي (Opening)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full p-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      value={formData.opening_accum_depreciation} 
                      onChange={e => setFormData({...formData, opening_accum_depreciation: parseFloat(e.target.value)})} 
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                  <Save size={18} />
                  {loading ? 'جاري الحفظ...' : 'حفظ البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all scale-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-600" />
                إضافة تصنيف جديد
              </h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCategorySubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">اسم التصنيف <span className="text-red-500">*</span></label>
                <input 
                  required 
                  type="text" 
                  className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                  value={newCategory.name} 
                  onChange={e => setNewCategory({...newCategory, name: e.target.value})} 
                  placeholder="مثال: معدات ثقيلة"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">العمر (سنوات)</label>
                  <input 
                    required 
                    type="number" 
                    min="1"
                    className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                    value={newCategory.life_years} 
                    onChange={e => setNewCategory({...newCategory, life_years: parseInt(e.target.value)})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">النسبة (%)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01"
                    readOnly
                    className="w-full p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed font-mono"
                    value={newCategory.rate} 
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-black transition-colors shadow-lg"
                >
                  {loading ? 'جاري الإضافة...' : 'إضافة التصنيف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, color, isNumber }: { title: string, value: string | number, color: string, isNumber?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  };

  const textColors: Record<string, string> = {
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    slate: 'text-slate-700',
  };

  return (
    <div className={`p-6 rounded-2xl border transition-all hover:shadow-md ${colors[color]}`}>
      <h3 className="text-slate-500 text-sm font-medium mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${textColors[color]} ${!isNumber && 'font-mono'}`}>{value}</p>
    </div>
  );
}

function formatMoney(amount: number) {
  return amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
}