
import React, { useState, useMemo, useRef } from 'react';
import { Product, Team, PaymentMethod, Transaction, CashLogType, LootConfig } from '../types';
import { formatPrice, Icons } from '../constants';

interface AdminProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  paymentMethods: PaymentMethod[];
  setPaymentMethods: React.Dispatch<React.SetStateAction<PaymentMethod[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  onReset: () => void;
  onUndoLast: () => void;
  lastTransaction?: Transaction;
  onAddCashLog: (amount: number, description: string, type: CashLogType) => void;
  lootConfig: LootConfig;
  setLootConfig: React.Dispatch<React.SetStateAction<LootConfig>>;
}

type DialogType = 'confirm' | 'prompt' | 'export' | null;
type AdminSubView = 'dashboard' | 'arsenal' | 'teams' | 'system';

// Imperialer Toggle Switch - Defined OUTSIDE to prevent re-renders
const ToggleSwitch = ({ active, onToggle, label, color = "bg-green-500" }: { active: boolean, onToggle: () => void, label: string, color?: string }) => (
  <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-neutral-800/50 mb-2">
    <span className="text-[9px] font-black uppercase text-neutral-500 italic tracking-widest">{label}</span>
    <button 
      onClick={onToggle}
      className={`w-10 h-5 rounded-full p-0.5 transition-all duration-300 relative ${active ? color : 'bg-neutral-800'}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-300 transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

const Admin: React.FC<AdminProps> = ({ 
  products, setProducts, 
  teams, setTeams, 
  paymentMethods, setPaymentMethods, 
  categories, setCategories,
  onReset, onUndoLast, lastTransaction,
  onAddCashLog,
  lootConfig, setLootConfig
}) => {
  const [subView, setSubView] = useState<AdminSubView>('dashboard');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('ALLE');
  
  // State für Finanzen
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  // State für Handbuch
  const [showManual, setShowManual] = useState(false);

  // Hidden File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DRAG & DROP STATE
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);

  const [dialog, setDialog] = useState<{
    type: DialogType;
    title: string;
    message: string;
    inputValue?: string;
    isDanger?: boolean;
    onConfirm: (val?: string) => void;
  } | null>(null);

  const askConfirm = (title: string, message: string, onConfirm: () => void, isDanger: boolean = false) => {
    setDialog({ 
      type: 'confirm', 
      title, 
      message, 
      isDanger,
      onConfirm: () => { onConfirm(); setDialog(null); } 
    });
  };

  const askPrompt = (title: string, message: string, initial: string, onConfirm: (val: string) => void) => {
    setDialog({ 
      type: 'prompt', title, message, inputValue: initial, 
      onConfirm: (val) => { if (val) onConfirm(val); setDialog(null); } 
    });
  };

  // --- CONFIG EXPORT / IMPORT LOGIC ---

  const handleExportConfig = () => {
    const configData = {
      meta: {
        type: "POCKET_HORNET_CONFIG",
        version: "2.4",
        date: new Date().toISOString(),
        exportedBy: "IMPERIAL_ADMIN_DROID"
      },
      payload: {
        products,
        teams,
        paymentMethods,
        categories,
        lootConfig
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(configData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    const fileName = `HORNET_CONFIG_${new Date().toISOString().slice(0, 10)}.json`;
    
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset input
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Basic Validation
        if (!data.meta || data.meta.type !== "POCKET_HORNET_CONFIG" || !data.payload) {
          throw new Error("Ungültiges Dateiformat. Dies ist kein Hornet-Config-Kristall.");
        }

        askConfirm(
          "SYSTEM ÜBERSCHREIBEN?", 
          `Config vom ${new Date(data.meta.date).toLocaleDateString()} laden? Aktuelle Einstellungen (Produkte, Teams) werden ersetzt!`, 
          () => applyImport(data.payload), 
          true
        );

      } catch (err) {
        alert("FEHLER BEIM LESEN: " + (err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const applyImport = (payload: any) => {
    try {
      if (payload.products) setProducts(payload.products);
      if (payload.teams) setTeams(payload.teams);
      if (payload.paymentMethods) setPaymentMethods(payload.paymentMethods);
      if (payload.categories) setCategories(payload.categories);
      if (payload.lootConfig) setLootConfig(payload.lootConfig);
      
      // Force Save to LocalStorage immediately to ensure persistence
      localStorage.setItem('gh_products', JSON.stringify(payload.products));
      localStorage.setItem('gh_teams', JSON.stringify(payload.teams));
      localStorage.setItem('gh_categories', JSON.stringify(payload.categories));
      
      alert("SYSTEM ERFOLGREICH AKTUALISIERT. RELOAD...");
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("KRITISCHER FEHLER BEIM IMPORT.");
    }
  };

  // --- FINANZ LOGIC ---

  const handleAddExpenseClick = () => {
    const amount = parseFloat(expenseAmount.replace(',', '.'));
    if (!amount || amount <= 0) return;
    const desc = expenseDesc.trim() || "Sonstiges";
    
    onAddCashLog(amount, desc, 'expense');
    setExpenseAmount('');
    setExpenseDesc('');
  };

  const handleDepositClick = () => {
    const amount = parseFloat(depositAmount.replace(',', '.'));
    if (!amount || amount <= 0) return;
    onAddCashLog(amount, "Bareinlage", 'deposit');
    setDepositAmount('');
  };

  const handleWithdrawDepositClick = () => {
    const amount = parseFloat(depositAmount.replace(',', '.'));
    if (!amount || amount <= 0) return;
    askConfirm("EINLAGE ZURÜCK?", `${formatPrice(amount)} Wechselgeld an Eigentümer zurückgeben?`, () => {
       onAddCashLog(amount, "Rückzahlung Bareinlage", 'withdraw');
       setDepositAmount('');
    });
  };

  // --- ARTIKEL LOGIC ---
  const filteredProducts = useMemo(() => {
    if (selectedFilterCategory === 'ALLE') return products;
    return products.filter(p => p.category?.toUpperCase() === selectedFilterCategory);
  }, [products, selectedFilterCategory]);

  const updateProduct = (id: string, field: keyof Product, value: any) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const deleteProduct = (id: string, name: string) => {
    askConfirm("ARTIKEL ENTFERNEN?", `"${name.toUpperCase()}" löschen?`, () => {
      setProducts(prev => prev.filter(p => p.id !== id));
    }, true);
  };

  const addProduct = () => {
    const newId = `p${Date.now()}`;
    const category = selectedFilterCategory === 'ALLE' ? (categories[0] || 'ALLGEMEIN') : selectedFilterCategory;
    setProducts([...products, { id: newId, name: 'Neuer Artikel', price: 0, active: true, category }]);
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedProductId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedProductId || draggedProductId === targetId) return;

    const oldIndex = products.findIndex(p => p.id === draggedProductId);
    const newIndex = products.findIndex(p => p.id === targetId);

    if (oldIndex === -1 || newIndex === -1) return;

    const newProducts = [...products];
    const [removed] = newProducts.splice(oldIndex, 1);
    newProducts.splice(newIndex, 0, removed);

    setProducts(newProducts);
    setDraggedProductId(null);
    if(window.navigator.vibrate) window.navigator.vibrate(10);
  };

  // --- BEREICH LOGIC ---
  const handleAddCategory = () => {
    askPrompt("NEUER BEREICH", "Name der Kategorie:", "", (name) => {
      const upper = name.trim().toUpperCase();
      if (!upper || categories.includes(upper)) return;
      setCategories(prev => [...prev, upper].sort());
    });
  };

  const handleRenameCategory = (oldName: string) => {
    askPrompt("BEREICH UMBENENNEN", `Neuer Name für "${oldName}":`, oldName, (newName) => {
      const upper = newName.trim().toUpperCase();
      if (!upper || upper === oldName) return;
      setCategories(prev => prev.map(c => c === oldName ? upper : c).sort());
      setProducts(prev => prev.map(p => p.category?.toUpperCase() === oldName ? { ...p, category: upper } : p));
      if (selectedFilterCategory === oldName) setSelectedFilterCategory(upper);
    });
  };

  const handleDeleteCategory = (catName: string) => {
    if (catName === 'ALLGEMEIN') return;
    askConfirm("BEREICH LÖSCHEN?", `"${catName}" entfernen? Artikel werden nach "ALLGEMEIN" verschoben.`, () => {
      setCategories(prev => prev.filter(c => c !== catName));
      setProducts(prev => prev.map(p => p.category?.toUpperCase() === catName ? { ...p, category: 'ALLGEMEIN' } : p));
      if (selectedFilterCategory === catName) setSelectedFilterCategory('ALLE');
    }, true);
  };

  // --- TEAM LOGIC ---
  const updateTeam = (id: string, field: keyof Team, value: any) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const deleteTeam = (id: string, name: string) => {
    askConfirm("EINHEIT AUFLÖSEN?", `"${name.toUpperCase()}" entfernen?`, () => {
      setTeams(prev => prev.filter(t => t.id !== id));
    }, true);
  };

  const addTeam = () => {
    const newId = `t${Date.now()}`;
    setTeams([...teams, { id: newId, name: 'Neues Team', active: true }]);
  };

  const handleFactoryReset = () => {
    askConfirm("TOTALER RESET?", "WIRKLICH ALLES AUF NULL SETZEN?", () => {
      localStorage.clear();
      window.location.reload();
    }, true);
  };

  // --- MANUAL / PDF GENERATION ---
  const getManualContent = () => {
    return `
      <div style="font-family: 'Helvetica', sans-serif; color: #000; padding: 20px; line-height: 1.5;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">Pocket Hornet</h1>
          <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #666;">Feldhandbuch & Bedienungsanleitung</div>
          <div style="font-size: 10px; margin-top: 5px;">Green Hornets Landshut | Bavarian Wood Edition</div>
        </div>

        <h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; text-transform: uppercase;">1. Die Kasse (POS)</h2>
        <p style="font-size: 12px;">Dies ist der Hauptbildschirm für den Verkauf.</p>
        <ul style="font-size: 12px;">
          <li><strong>Team wählen:</strong> Klicke oben auf den Button "EMPFÄNGER WÄHLEN", um ein Team auszuwählen oder neu anzulegen.</li>
          <li><strong>Artikel buchen:</strong> Tippe auf die Artikel. Ein grüner Zähler zeigt die Menge an. Zum Korrigieren: Rechtsklick oder langes Drücken (je nach Gerät) entfernt Artikel.</li>
          <li><strong>Direktverkauf (Bar):</strong> Wähle "BAR" als Zahlungsmethode. Wenn kein Team gewählt ist, fragt das System höflich nach einem Namen für die Statistik oder erlaubt eine anonyme Buchung.</li>
          <li><strong>Rechnung / Anschreiben:</strong> Wähle "RECHNUNG". Dies erfordert zwingend eine Team-Zuordnung. Die Beträge landen in den "Offenen Posten".</li>
          <li><strong>Intern / Orga:</strong> Wähle ein internes Team (z.B. Green Hornets), um den Button "BUCHUNG: INTERN" freizuschalten. Dies erfasst den Verbrauch ohne Geldfluss.</li>
        </ul>

        <h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; text-transform: uppercase;">2. Tribut (Offene Posten)</h2>
        <p style="font-size: 12px;">Hier verwaltest du Schulden und Rechnungen.</p>
        <ul style="font-size: 12px;">
          <li><strong>Übersicht:</strong> Siehe sofort, wer wie viel schuldet (Rot) oder wie viel Umsatz gemacht wurde (Grün).</li>
          <li><strong>Detail & Druck:</strong> Klicke auf eine Karte, um die Rechnung zu sehen. Dort kannst du einzelne Posten stornieren, die Rechnung drucken (PDF) oder teilen.</li>
          <li><strong>Begleichen:</strong> Nutze den Button "TRIBUT BEGLEICHEN", wenn ein Team seine Schulden bezahlt (setzt Status auf "Settled").</li>
        </ul>

        <h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; text-transform: uppercase;">3. Bericht (Finanz-Analyse)</h2>
        <p style="font-size: 12px;">Das Herzstück der Buchhaltung.</p>
        <ul style="font-size: 12px;">
          <li><strong>Bilanz & Journal:</strong> Klicke unten auf "EINSATZ-BILANZ & JOURNAL". Dies ist eine lückenlose Liste aller Vorgänge (Einnahmen, Ausgaben, Stornos) – ideal für den Kassenabschluss.</li>
          <li><strong>Kriegskasse:</strong> Zeigt den theoretischen Bargeldbestand (Soll-Bestand) unter Berücksichtigung von Einlagen und Entnahmen.</li>
          <li><strong>Gewinnrechnung:</strong> Zieht automatisch Kosten für Paint (siehe Admin) und Miete vom Umsatz ab.</li>
        </ul>

        <h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; text-transform: uppercase;">4. Admin & Konfiguration</h2>
        <ul style="font-size: 12px;">
          <li><strong>Arsenal (Artikel):</strong> Hier legst du neue Artikel an. <strong>Tipp:</strong> Halte das Griff-Symbol gedrückt, um Artikel per Drag & Drop zu sortieren!</li>
          <li><strong>Finanz-Operationen:</strong> Buche hier Ausgaben (z.B. Pizza-Bestellung aus der Kasse) oder Einlagen (Wechselgeld).</li>
          <li><strong>Loot Config:</strong> Stelle hier Einkaufspreise für Paint und Hallenmiete ein, damit der Gewinn korrekt berechnet wird.</li>
        </ul>

        <h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; text-transform: uppercase;">5. System-Transfer (Daten-Kristall)</h2>
        <p style="font-size: 12px;">Der neue Standard für Backups und Gerätewechsel im "System Core".</p>
        <ul style="font-size: 12px;">
          <li><strong>Export (Backup):</strong> Speichert die gesamte Konfiguration (Artikel, Teams, Loot-Settings) in einer JSON-Datei ("Daten-Kristall") auf Ihrem Gerät. Teilen Sie diese Datei, um Einstellungen zu sichern.</li>
          <li><strong>Import (Restore):</strong> Lädt eine Config-Datei und richtet das System sofort neu ein. <strong>Achtung:</strong> Überschreibt aktuelle Einstellungen! Ideal für die Synchronisation mehrerer Geräte.</li>
        </ul>

        <h2 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; text-transform: uppercase;">6. Profi-Tipps</h2>
        <ul style="font-size: 12px;">
          <li><strong>Offline:</strong> Die App funktioniert zu 100% offline. Daten werden im Browser gespeichert.</li>
          <li><strong>Storno:</strong> Im Admin-Dashboard gibt es einen "Quick-Void" Button für die allerletzte Buchung. Einzelne ältere Buchungen stornierst du im "Tribut" Bereich in den Details.</li>
          <li><strong>Daten-Sicherheit:</strong> Mache regelmäßig Screenshots der Bilanz oder nutze die "Drucken/PDF" Funktion am Ende des Events. Ein "Totaler Reset" löscht alles unwiderruflich!</li>
        </ul>
        
        <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #999;">
           END OF DOCUMENT - IMPERIAL CODING PROTOCOL
        </div>
      </div>
    `;
  };

  const handlePrintManual = () => {
    const win = window.open('', '', 'width=800,height=900');
    if (!win) return;
    win.document.write(`<html><head><title>POCKET HORNET HANDBUCH</title></head><body>${getManualContent()}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };


  const BackButton = () => (
    <button 
      onClick={() => setSubView('dashboard')}
      className="mb-6 flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-neutral-400 active:scale-95 transition-all shadow-md"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
      Zurück zum HUD
    </button>
  );

  return (
    <div className="p-4 h-full overflow-y-auto bg-black pb-32 scrollbar-hide relative">
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />

      {subView === 'dashboard' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 text-center pt-4">
            <h2 className="font-sci-fi text-2xl font-black text-white italic tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">Command Center</h2>
            <p className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.4em] mt-1 italic">Imperial Admin Protocol</p>
          </div>

          <div className="mb-6 bg-red-950/20 border-2 border-red-500/30 p-5 rounded-[32px] shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500 mb-4 px-1 flex items-center gap-2 italic">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></span>
              Quick-Void System
            </h3>
            {lastTransaction ? (
              <button 
                onClick={() => askConfirm("STORNO?", `Letzte Buchung (${formatPrice(lastTransaction.total)}) stornieren?`, onUndoLast, true)}
                className="w-full bg-red-600 text-white py-5 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform"
              >
                STORNO: {formatPrice(lastTransaction.total)}
              </button>
            ) : (
              <p className="text-[9px] text-neutral-600 font-black uppercase text-center py-2 italic tracking-widest">Keine Logs verfügbar</p>
            )}
          </div>

          {/* FINANCE OPERATIONS */}
          <div className="mb-8 bg-neutral-900/40 border-2 border-orange-500/30 p-5 rounded-[32px] shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-400 mb-6 px-1 flex items-center gap-2 italic">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_orange]"></span>
              Finanz-Operationen
            </h3>
            
            <div className="flex flex-col gap-6">
              
              {/* AUSGABEN (Verlust) */}
              <div className="bg-orange-950/10 p-4 rounded-3xl border border-orange-500/10">
                 <div className="text-[8px] font-black uppercase text-orange-600 mb-2 tracking-widest">Operative Ausgaben</div>
                 <div className="flex gap-2 mb-2">
                   <input 
                     type="number" 
                     value={expenseAmount}
                     onChange={(e) => setExpenseAmount(e.target.value)}
                     placeholder="Betrag (€)" 
                     className="w-1/3 bg-black border border-orange-900/50 rounded-xl px-4 py-3 text-white font-mono font-bold placeholder-neutral-700 outline-none focus:border-orange-500"
                   />
                   <input 
                     type="text" 
                     value={expenseDesc}
                     onChange={(e) => setExpenseDesc(e.target.value)}
                     placeholder="Zweck..." 
                     className="flex-1 bg-black border border-orange-900/50 rounded-xl px-4 py-3 text-white font-bold uppercase text-xs placeholder-neutral-700 outline-none focus:border-orange-500"
                   />
                </div>
                <button 
                  onClick={handleAddExpenseClick}
                  className="w-full bg-orange-600 text-black py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform"
                >
                  Als Ausgabe (BARGELD) buchen
                </button>
              </div>

              {/* BAREINLAGE / WECHSELGELD (Cash Flow) */}
              <div className="bg-[#0098d4]/10 p-4 rounded-3xl border border-[#0098d4]/10">
                 <div className="text-[8px] font-black uppercase text-[#0098d4] mb-2 tracking-widest">Wechselgeld / Cash Fund</div>
                 <div className="flex gap-2 mb-2">
                   <input 
                     type="number" 
                     value={depositAmount}
                     onChange={(e) => setDepositAmount(e.target.value)}
                     placeholder="Betrag (€)" 
                     className="w-full bg-black border border-[#0098d4]/30 rounded-xl px-4 py-3 text-white font-mono font-bold placeholder-neutral-700 outline-none focus:border-[#0098d4]"
                   />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleDepositClick}
                    className="flex-1 bg-[#0098d4] text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-transform"
                  >
                    Bareinlage (+)
                  </button>
                  <button 
                    onClick={handleWithdrawDepositClick}
                    className="flex-1 bg-red-900/40 text-red-500 border border-red-500/30 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-transform hover:bg-red-900/60"
                  >
                    Rückzahlung (-)
                  </button>
                </div>
              </div>

              {/* HORNETS LOOT ANALYSE INPUT TOOL */}
              <div className="bg-purple-950/10 p-4 rounded-3xl border border-purple-500/10">
                 <div className="flex justify-between items-center mb-2">
                   <div className="text-[8px] font-black uppercase text-purple-400 tracking-widest">Hornets Loot Analyse Input Tool</div>
                 </div>
                 <div className="text-[7px] font-bold uppercase text-purple-600 mb-3 tracking-wide">(Wareneinkauf / Unkosten f. genaue Gewinnrechnung)</div>
                 
                 <div className="mb-3">
                    <ToggleSwitch 
                       active={lootConfig.active}
                       onToggle={() => setLootConfig(prev => ({...prev, active: !prev.active}))}
                       label={lootConfig.active ? "KALKULATION: AKTIV" : "KALKULATION: INAKTIV"}
                       color="bg-purple-600"
                    />
                 </div>

                 <div className="space-y-2">
                    <div className="flex items-center gap-2">
                       <span className="w-24 text-[8px] font-black uppercase text-neutral-500">Paint pro Kiste</span>
                       <input 
                          type="number" 
                          value={lootConfig.paintCostPerBox || ''}
                          onChange={(e) => setLootConfig(prev => ({...prev, paintCostPerBox: parseFloat(e.target.value) || 0}))}
                          className="flex-1 bg-black border border-purple-900/30 rounded-lg px-2 py-2 text-xs font-mono text-purple-400 outline-none focus:border-purple-500"
                          placeholder="0.00"
                       />
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="w-24 text-[8px] font-black uppercase text-neutral-500">Miete Halle</span>
                       <input 
                          type="number" 
                          value={lootConfig.rentCost || ''}
                          onChange={(e) => setLootConfig(prev => ({...prev, rentCost: parseFloat(e.target.value) || 0}))}
                          className="flex-1 bg-black border border-purple-900/30 rounded-lg px-2 py-2 text-xs font-mono text-purple-400 outline-none focus:border-purple-500"
                          placeholder="0.00"
                       />
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="w-24 text-[8px] font-black uppercase text-neutral-500">Einkauf Essen/Tr.</span>
                       <input 
                          type="number" 
                          value={lootConfig.foodCost || ''}
                          onChange={(e) => setLootConfig(prev => ({...prev, foodCost: parseFloat(e.target.value) || 0}))}
                          className="flex-1 bg-black border border-purple-900/30 rounded-lg px-2 py-2 text-xs font-mono text-purple-400 outline-none focus:border-purple-500"
                          placeholder="0.00"
                       />
                    </div>

                    <div className="pt-2 border-t border-purple-900/20 mt-2">
                       <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase text-neutral-500">Status Miete</span>
                          <button 
                             onClick={() => setLootConfig(prev => ({...prev, rentPaid: !prev.rentPaid}))}
                             className={`text-[8px] font-black px-2 py-1 rounded border uppercase ${lootConfig.rentPaid ? 'bg-green-900/20 text-green-500 border-green-500/30' : 'bg-red-900/20 text-red-500 border-red-500/30'}`}
                          >
                             {lootConfig.rentPaid ? "BEREITS ENTDOMMEN (BEZAHLT)" : "NOCH NICHT ENTDOMMEN"}
                          </button>
                       </div>
                    </div>

                 </div>
              </div>

            </div>
          </div>

          <div className="mb-8">
             <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mb-3 px-1 italic">Help & Intel</h3>
             <button 
               onClick={() => setShowManual(true)}
               className="w-full bg-blue-900/20 border border-blue-500/30 py-4 rounded-2xl text-[12px] font-black uppercase text-blue-400 tracking-widest shadow-lg active:scale-95 flex items-center justify-center gap-2"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
               HANDBUCH & ANLEITUNG
             </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button onClick={() => setSubView('arsenal')} className="group relative overflow-hidden bg-neutral-900 border border-green-500/20 p-8 rounded-[32px] text-left transition-all active:scale-[0.98] shadow-xl">
              <h4 className="font-sci-fi text-xl font-black text-green-500 uppercase italic mb-1">Arsenal Manager</h4>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Artikel & Bereiche</p>
            </button>
            <button onClick={() => setSubView('teams')} className="group relative overflow-hidden bg-neutral-900 border border-[#0098d4]/20 p-8 rounded-[32px] text-left transition-all active:scale-[0.98] shadow-xl">
              <h4 className="font-sci-fi text-xl font-black text-[#0098d4] uppercase italic mb-1">Team Area</h4>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Einheiten-Verwaltung</p>
            </button>
            <button onClick={() => setSubView('system')} className="group relative overflow-hidden bg-neutral-900 border border-purple-500/20 p-8 rounded-[32px] text-left transition-all active:scale-[0.98] shadow-xl">
              <h4 className="font-sci-fi text-xl font-black text-purple-500 uppercase italic mb-1">System Core</h4>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Config & Security</p>
            </button>
          </div>
        </div>
      )}

      {subView === 'arsenal' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <BackButton />
          <div className="mb-10">
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-green-500 font-sci-fi italic">Bereichs-Manager</h3>
              <button onClick={handleAddCategory} className="bg-green-600 text-black px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-lg">Neu +</button>
            </div>
            <div className="flex flex-col gap-2">
              {categories.map(cat => (
                <div key={cat} className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-2xl flex justify-between items-center">
                  <span className="text-[12px] font-black text-white uppercase tracking-widest italic">{cat}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleRenameCategory(cat)} className="w-8 h-8 flex items-center justify-center bg-neutral-800 rounded-lg text-neutral-400 active:bg-green-600 active:text-black">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M7.127 22.562l-7.127 1.438 1.438-7.128 5.689 5.69zm1.414-1.414l11.228-11.225-5.69-5.692-11.227 11.227 5.689 5.69zm9.768-21.148l-2.816 2.817 5.691 5.691 2.816-2.819-5.692-5.689z"/></svg>
                    </button>
                    <button onClick={() => handleDeleteCategory(cat)} disabled={cat === 'ALLGEMEIN'} className={`w-8 h-8 flex items-center justify-center rounded-lg ${cat === 'ALLGEMEIN' ? 'opacity-10' : 'bg-red-900/10 text-red-500 border border-red-500/20 active:bg-red-600'}`}>X</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-col gap-4 mb-4 px-2">
               <div className="flex justify-between items-center">
                  <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-green-500 font-sci-fi italic">Artikel Arsenal</h3>
                  <button onClick={addProduct} className="bg-green-600 text-black px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-lg">Neu +</button>
               </div>
               
               {/* Filter für einfacheres Sortieren */}
               <div className="bg-neutral-900 p-2 rounded-xl border border-neutral-800 flex gap-2 overflow-x-auto scrollbar-hide">
                  <button 
                    onClick={() => setSelectedFilterCategory('ALLE')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-colors ${selectedFilterCategory === 'ALLE' ? 'bg-green-500 text-black' : 'text-neutral-500 bg-black hover:text-white'}`}
                  >
                    ALLE
                  </button>
                  {categories.map(c => (
                     <button 
                       key={c}
                       onClick={() => setSelectedFilterCategory(c)}
                       className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-colors ${selectedFilterCategory === c ? 'bg-green-500 text-black' : 'text-neutral-500 bg-black hover:text-white'}`}
                     >
                       {c}
                     </button>
                  ))}
               </div>
               <p className="text-[8px] uppercase text-neutral-600 font-bold px-1">
                 Info: Halte den Griff <Icons.DragHandle className="w-3 h-3 inline align-middle text-neutral-400" /> gedrückt, um die Reihenfolge für die Kasse zu ändern.
               </p>
            </div>

            <div className="flex flex-col gap-3">
              {filteredProducts.map(p => (
                <div 
                  key={p.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, p.id)}
                  className={`bg-neutral-900/40 border p-4 pl-2 rounded-[28px] transition-all duration-300 relative group flex gap-3 items-start ${p.active ? 'border-neutral-800' : 'border-red-900/20 opacity-60 grayscale'} ${draggedProductId === p.id ? 'opacity-30 border-green-500 border-dashed scale-[0.98]' : ''}`}
                >
                  {/* DRAG HANDLE */}
                  <div className="mt-2 text-neutral-600 cursor-grab active:cursor-grabbing hover:text-green-500 transition-colors p-2">
                     <Icons.DragHandle className="w-5 h-5" />
                  </div>

                  <div className="flex-1">
                     <div className="flex gap-3 mb-2">
                       <input type="text" value={p.name} onChange={(e) => updateProduct(p.id, 'name', e.target.value)} className="flex-1 bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold uppercase text-white" />
                       <input type="number" step="0.1" value={p.price} onChange={(e) => updateProduct(p.id, 'price', parseFloat(e.target.value) || 0)} className="w-20 bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-green-500" />
                     </div>
                     
                     <div className="mt-2">
                       <ToggleSwitch 
                         active={p.active} 
                         onToggle={() => updateProduct(p.id, 'active', !p.active)} 
                         label={p.active ? "STATUS: EINSATZBEREIT" : "STATUS: DEAKTIVIERT"}
                       />
                     </div>

                     <div className="flex justify-between mt-2">
                        <select value={p.category || ''} onChange={(e) => updateProduct(p.id, 'category', e.target.value)} className="bg-black text-[9px] font-black uppercase border border-neutral-800 rounded px-2 py-1 text-neutral-400">
                           {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => deleteProduct(p.id, p.name)} className="text-red-500 text-[9px] font-black uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors active:bg-red-600 active:text-white">Löschen</button>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subView === 'teams' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <BackButton />
          <div className="mb-10">
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-[#0098d4] font-sci-fi italic">Team-Management</h3>
              <button onClick={addTeam} className="bg-[#0098d4] text-white px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-lg">Neu +</button>
            </div>
            <div className="flex flex-col gap-3">
              {teams.map(t => (
                <div key={t.id} className={`bg-neutral-900/40 border p-4 rounded-[28px] transition-all duration-300 flex flex-col gap-3 ${t.active ? 'border-neutral-800' : 'border-red-900/20 opacity-60 grayscale'}`}>
                  <input type="text" value={t.name} onChange={(e) => updateTeam(t.id, 'name', e.target.value)} className="bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold uppercase text-white w-full focus:border-[#0098d4]" />
                  
                  <ToggleSwitch 
                    active={t.active} 
                    onToggle={() => updateTeam(t.id, 'active', !t.active)} 
                    label={t.active ? "STATUS: AKTIV" : "STATUS: INAKTIV"}
                    color="bg-[#0098d4]"
                  />

                  <div className="text-right">
                    <button onClick={() => deleteTeam(t.id, t.name)} className="text-red-500 text-[9px] font-black uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 active:bg-red-600 active:text-white">Löschen</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subView === 'system' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <BackButton />
          <div className="mb-10 bg-purple-900/10 border border-purple-500/30 p-6 rounded-[32px] shadow-xl">
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400 mb-6 font-sci-fi italic">Konfigurations-Matrix</h3>
             
             <div className="flex flex-col gap-4">
                <button onClick={handleExportConfig} className="w-full bg-purple-600 text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform flex flex-col items-center">
                   <span>DATEN-KRISTALL EXPORTIEREN</span>
                   <span className="text-[8px] opacity-60 mt-1">(JSON Backup speichern)</span>
                </button>
                
                <button onClick={handleImportClick} className="w-full bg-purple-900/20 border border-purple-500/50 text-purple-300 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform flex flex-col items-center hover:bg-purple-900/40">
                   <span>SYSTEM-CORE ÜBERSCHREIBEN (IMPORT)</span>
                   <span className="text-[8px] opacity-60 mt-1">(JSON Config laden & anwenden)</span>
                </button>
             </div>
          </div>

          <div className="mt-20 pt-10 border-t border-neutral-900 text-center">
             <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-red-700 mb-6 italic">Danger Zone</h3>
             <div className="flex flex-col gap-4">
               <button onClick={onReset} className="w-full bg-neutral-900 border border-red-900/30 py-4 rounded-2xl text-[10px] font-black uppercase text-red-500 tracking-widest shadow-lg">Kasse nullen</button>
               <button onClick={handleFactoryReset} className="w-full bg-red-900/20 border border-red-500/50 py-4 rounded-2xl text-[10px] font-black uppercase text-white tracking-widest shadow-lg active:bg-red-600">Werkseinstellung (Reset)</button>
             </div>
          </div>
        </div>
      )}

      {/* --- MANUAL MODAL --- */}
      {showManual && (
        <div className="fixed inset-0 z-[3000] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in duration-200">
           <div className="shrink-0 p-5 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center shadow-lg relative z-10">
            <div>
               <h2 className="text-xl font-sci-fi font-black text-white italic uppercase">Feldhandbuch</h2>
               <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em]">Bedienungsanleitung & Tipps</p>
            </div>
            <button 
               onClick={() => setShowManual(false)} 
               className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center font-bold active:scale-90"
            >
               ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-white text-black font-sans leading-relaxed">
             <div className="max-w-2xl mx-auto py-8" dangerouslySetInnerHTML={{ __html: getManualContent() }} />
          </div>

          <div className="shrink-0 p-4 bg-neutral-900 border-t border-neutral-800 pb-safe">
             <button 
                onClick={handlePrintManual}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
             >
                DRUCKEN / PDF SPEICHERN
             </button>
          </div>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-[32px] border-2 p-8 shadow-2xl ${dialog.isDanger ? 'border-red-500/30 bg-neutral-950' : 'border-green-500/30 bg-neutral-900'}`}>
            <h4 className={`text-xl font-sci-fi font-black uppercase italic mb-2 ${dialog.isDanger ? 'text-red-500' : 'text-green-500'}`}>{dialog.title}</h4>
            <p className="text-neutral-400 text-xs font-bold uppercase mb-8 leading-relaxed tracking-tight">{dialog.message}</p>
            
            {dialog.type === 'prompt' && (
              <input 
                autoFocus
                defaultValue={dialog.inputValue}
                onChange={(e) => { if (dialog) dialog.inputValue = e.target.value; }}
                className="w-full bg-black border border-neutral-800 p-4 rounded-2xl text-white font-black uppercase text-xs mb-8 outline-none focus:border-green-500 shadow-inner"
              />
            )}

            {dialog.type === 'export' && (
              <textarea 
                autoFocus
                defaultValue={dialog.inputValue}
                readOnly
                className="w-full bg-black border border-neutral-800 p-4 rounded-2xl text-white font-mono text-[10px] mb-8 outline-none focus:border-green-500 shadow-inner h-40 resize-none scrollbar-hide"
              />
            )}

            <div className="flex gap-4">
              <button onClick={() => setDialog(null)} className="flex-1 py-4 rounded-2xl bg-neutral-800 text-neutral-400 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform">
                {dialog.type === 'export' ? 'Schließen' : 'Abbruch'}
              </button>
              {dialog.type !== 'export' && (
                <button onClick={() => dialog.onConfirm(dialog.inputValue)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform ${dialog.isDanger ? 'bg-red-600 text-white' : 'bg-green-600 text-black'}`}>
                  Bestätigen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
