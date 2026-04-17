"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { ChevronRight, ChevronDown, Plus, Package, MapPin, Layers, Box, QrCode } from "lucide-react";
import { Location } from "@prisma/client";

interface LocationTreeProps {
  locations: Location[];
}

export function LocationManager({ locations }: LocationTreeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", type: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive active location
  const selectedNode = locations.find((l) => l.id === selectedId) || null;

  const toggleExpand = (id: string, forceExpandState?: boolean) => {
    setExpandedNodes(prev => ({
      ...prev,
      [id]: forceExpandState !== undefined ? forceExpandState : !prev[id]
    }));
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'WAREHOUSE': return <MapPin className="w-4 h-4 text-emerald-600" />;
      case 'ZONE': return <Layers className="w-4 h-4 text-orange-500" />;
      case 'SHELF': return <Package className="w-4 h-4 text-blue-500" />;
      case 'BIN': return <Box className="w-4 h-4 text-slate-500" />;
      default: return <MapPin className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type || (selectedId ? "ZONE" : "WAREHOUSE"),
          description: formData.description,
          parentId: selectedId,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        alert("Error: " + errorText);
        return;
      }

      setIsAddOpen(false);
      setFormData({ name: "", type: "", description: "" });
      // In a real app we'd trigger a router.refresh() or mutate SWR here.
      window.location.reload(); 
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build the recursive hierarchy rendering function
  const renderTree = (parentId: string | null = null, depth = 0) => {
    const children = locations.filter((loc) => loc.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <ul className={`flex flex-col space-y-1 ${depth > 0 ? "ml-4 pl-2 border-l border-slate-200 mt-1" : ""}`}>
        {children.map((child) => {
          const hasChildren = locations.some((l) => l.parentId === child.id);
          const isExpanded = !!expandedNodes[child.id];
          const isSelected = selectedId === child.id;

          return (
            <li key={child.id} className="relative">
              <div 
                onClick={() => setSelectedId(child.id)}
                className={`flex items-center gap-2 py-1.5 px-2 text-sm rounded-md cursor-pointer transition-colors ${
                  isSelected ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                {/* Expand Toggle */}
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasChildren) toggleExpand(child.id);
                  }}
                  className={`w-4 h-4 flex items-center justify-center rounded hover:bg-slate-200 ${!hasChildren && "invisible"}`}
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </span>

                {getIconForType(child.type)}
                <span className="font-medium mr-2">{child.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium tracking-wider">
                  {child.type}
                </span>
              </div>
              
              {/* Recursive Children Drop */}
              {hasChildren && isExpanded && (
                <div className="overflow-hidden">
                  {renderTree(child.id, depth + 1)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  const allowedChildTypes = (parentType: string) => {
    switch (parentType) {
       case 'WAREHOUSE': return ['ZONE', 'PRODUCTION', 'SHIPPING', 'QUARANTINE', 'DEFECTIVE', 'RECEIVING', 'OTHER'];
       case 'ZONE': return ['SHELF', 'BIN', 'OTHER'];
       case 'SHELF': return ['BIN'];
       case 'BIN': return [];
       default: return ['BIN'];
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[600px] border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
      
      {/* Left Pane - Tree View */}
      <div className="w-1/3 min-w-[300px] border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <h2 className="font-semibold text-slate-800">Hierarchy Map</h2>
          <button 
            onClick={() => { setSelectedId(null); setIsAddOpen(true); }}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            title="Add Top-Level Warehouse"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          {locations.length === 0 ? (
            <div className="text-center p-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
              No mapped locations. Add a Warehouse to originate physical tracking.
            </div>
          ) : (
            renderTree(null, 0)
          )}
        </div>
      </div>

      {/* Right Pane - Details */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedNode ? (
          <div className="flex-1 flex flex-col">
            {/* Context Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start">
               <div>
                  <div className="flex items-center gap-3 mb-1">
                     {getIconForType(selectedNode.type)}
                     <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">{selectedNode.type}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800">{selectedNode.name}</h1>
                  {selectedNode.description && (
                    <p className="text-slate-500 mt-2 text-sm max-w-xl">{selectedNode.description}</p>
                  )}
               </div>
               
               <div className="flex gap-2 text-sm">
                  <button className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors">
                    Edit Location
                  </button>
                  {allowedChildTypes(selectedNode.type).length > 0 && (
                    <button 
                      onClick={() => setIsAddOpen(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add Child
                    </button>
                  )}
               </div>
            </div>

            {/* Dashboard grid for this location */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 overflow-auto bg-slate-50/50">
               {/* Identity Card */}
               <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col items-center">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2 w-full border-b border-slate-100 pb-4">
                    <QrCode className="w-4 h-4 text-indigo-500" /> Print Identity Label
                  </h3>
                  
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-inner max-w-[200px] w-full aspect-square flex items-center justify-center mb-4">
                     <QRCode 
                        value={selectedNode.qrCode || selectedNode.id} 
                        size={160}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                     />
                  </div>
                  <p className="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-1.5 rounded-md">
                     {selectedNode.qrCode || "No QR generated"}
                  </p>
                  <button className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors">
                    Send to Thermal Printer (USB)
                  </button>
               </div>

               {/* Metrics Placeholder */}
               <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 border-b border-slate-100 pb-4">
                    Location Metrics
                  </h3>
                  <div className="flex flex-col gap-4 text-center items-center justify-center h-48 text-slate-400">
                     <Package className="w-8 h-8 opacity-50 mb-2" />
                     <p className="text-sm">Stock levels will manifest here once Transfer Engine is online.</p>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
             <MapPin className="w-12 h-12 mb-4 opacity-50 text-indigo-300" />
             <h3 className="text-lg font-medium text-slate-600">No Location Selected</h3>
             <p className="text-sm mt-1 max-w-sm text-center">Click a node on the layout tree to view capabilities, scan QR mappings, or append sub-locations.</p>
          </div>
        )}
      </div>

      {/* Creation Modal (Very naive implementation for speed) */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100 overflow-hidden">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
               <h3 className="text-lg font-bold text-slate-800">
                 {selectedId && selectedNode ? `Add component into ${selectedNode.name}` : "Establish Top-Level Warehouse"}
               </h3>
             </div>
             
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Entity Name</label>
                 <input 
                   required
                   type="text" 
                   value={formData.name}
                   onChange={e => setFormData({ ...formData, name: e.target.value })}
                   className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                   placeholder="e.g. Rack A7 or Central Warehouse"
                 />
               </div>

               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
                 <select
                   required
                   value={formData.type}
                   onChange={e => setFormData({ ...formData, type: e.target.value })}
                   className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                 >
                   <option value="" disabled>Select scale format...</option>
                   {!selectedId ? (
                      <option value="WAREHOUSE">Primary Warehouse</option>
                   ) : (
                      allowedChildTypes(selectedNode!.type).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))
                   )}
                 </select>
               </div>

               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                 <textarea 
                   rows={3}
                   value={formData.description}
                   onChange={e => setFormData({ ...formData, description: e.target.value })}
                   className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                   placeholder="A brief layout description..."
                 />
               </div>

               <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors text-sm shadow-sm disabled:opacity-50"
                  >
                    {isSubmitting ? "Committing..." : "Forge Entity"}
                  </button>
               </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
}
