import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import newsService, { type NewsItem, type CreateNewsPayload } from "../../lib/news-service";
import communityService, { type CommunityListItem } from "../../lib/community-service";
import apiClient, { API_BASE_URL } from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";
import { toast } from "sonner";
import {
  AlertTriangle, Edit2, Globe, Image as ImageIcon,
  Pencil, Plus, RefreshCw, Search, Trash2, X,
} from "lucide-react";

// ─── AuthImage ────────────────────────────────────────────────

function AuthImage({ src: filePath, style, alt = "" }: { src: string; style?: React.CSSProperties; alt?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    const url = filePath.startsWith("/") ? `${API_BASE_URL}${filePath}` : `${API_BASE_URL}/files/${filePath}/stream`;
    const token = localStorage.getItem("auth_token");
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((blob) => { revoke = URL.createObjectURL(blob); setBlobUrl(revoke); })
      .catch(() => setBlobUrl(null));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [filePath]);
  if (!blobUrl) return null;
  return <img src={blobUrl} alt={alt} style={style} />;
}

// ─── Types ────────────────────────────────────────────────────

type FormState = {
  caption: string;
  communityId: string;
  imageFile: File | null;
  existingImageFileId: string;
};
const EMPTY_FORM: FormState = { caption: "", communityId: "", imageFile: null, existingImageFileId: "" };

// ─── Tokens ───────────────────────────────────────────────────

const ff     = "'Work Sans', sans-serif";
const ffMono = "'DM Mono', monospace";

const inputBase: React.CSSProperties = {
  height: "36px", borderRadius: "7px", border: "1px solid #E5E7EB",
  background: "#FFF", fontFamily: ff, fontSize: "12.5px", color: "#111827",
  outline: "none", padding: "0 10px", boxSizing: "border-box", width: "100%",
};
const selectStyle: React.CSSProperties = { ...inputBase, cursor: "pointer" };

// ─── Avatar ───────────────────────────────────────────────────

function Avatar({ name, src, size = 38 }: { name: string; src?: string | null; size?: number }) {
  const palette = ["#EFF6FF:#1D4ED8","#ECFDF5:#059669","#FEF2F2:#B91C1C","#FFF7ED:#C2410C","#F5F3FF:#6D28D9","#F0FDF4:#166534"];
  const [bg, color] = palette[(name.charCodeAt(0)||65) % palette.length].split(":");
  const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map((p)=>p[0]?.toUpperCase()).join("") || "?";
  const s: React.CSSProperties = { width:size, height:size, borderRadius:"50%", flexShrink:0 };
  if (src) return <AuthImage src={src} style={{ ...s, objectFit:"cover" }} />;
  return <div style={{ ...s, background:bg, color, fontSize:size*0.35, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:ff }}>{initials}</div>;
}

// ─── Feed card ────────────────────────────────────────────────

function FeedCard({ item, onView, onEdit, onDelete }: { item: NewsItem; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const [hov, setHov] = useState<string | null>(null);

  const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });

  return (
    <div style={{ borderRadius:"14px", border:"1px solid #EBEBEB", background:"#FFF", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", transition:"box-shadow 160ms" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}>

      {/* Author row */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"14px 16px 10px" }}>
        <Avatar name={item.authorName||"?"} src={item.authorPhotoUrl} size={40} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:"13.5px", fontWeight:700, color:"#111827", margin:0, fontFamily:ff }}>{item.authorName||"Unknown"}</p>
          <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"2px" }}>
            <span style={{ fontSize:"11px", color:"#9CA3AF", fontFamily:ffMono }}>{dateStr}</span>
            {item.communityName && (
              <>
                <span style={{ width:"3px", height:"3px", borderRadius:"50%", background:"#D1D5DB", display:"inline-block" }} />
                <span style={{ display:"inline-flex", alignItems:"center", gap:"3px", fontSize:"10.5px", fontWeight:700, padding:"1px 7px", borderRadius:"20px", background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", fontFamily:ff }}>
                  <Globe style={{ width:"8px", height:"8px" }} />{item.communityName}
                </span>
              </>
            )}
          </div>
        </div>
        {/* Action dots */}
        <div style={{ display:"flex", gap:"4px" }}>
          {[
            { id:"edit", icon:<Edit2 style={{ width:"12px", height:"12px" }} />, onClick:onEdit, color:"#374151" },
            { id:"del",  icon:<Trash2 style={{ width:"12px", height:"12px" }} />, onClick:onDelete, color:"#DC2626" },
          ].map(({ id, icon, onClick, color }) => (
            <button key={id} type="button" onClick={onClick}
              style={{ width:"28px", height:"28px", borderRadius:"7px", border:`1px solid ${hov===id?"#E5E7EB":"transparent"}`, background:hov===id?"#F9FAFB":"transparent", color:hov===id?color:"#9CA3AF", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 120ms" }}
              onMouseEnter={() => setHov(id)} onMouseLeave={() => setHov(null)}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Caption */}
      <div style={{ padding:"0 16px 12px" }}>
        <p style={{ fontSize:"13.5px", color:"#374151", margin:0, lineHeight:1.65, whiteSpace:"pre-wrap", fontFamily:ff }}>{item.caption}</p>
      </div>

      {/* Image */}
      {item.imageFileId && (
        <div style={{ borderTop:"1px solid #F3F4F6", cursor:"pointer" }} onClick={onView}>
          <AuthImage src={item.imageFileId} style={{ width:"100%", maxHeight:"400px", objectFit:"cover", display:"block" }} />
        </div>
      )}

      {/* Footer */}
      <div style={{ padding:"10px 16px", borderTop:"1px solid #F3F4F6", display:"flex", alignItems:"center", justifyContent:"flex-end" }}>
        <button type="button" onClick={onView}
          style={{ fontSize:"12px", fontWeight:700, color:"#6B7280", fontFamily:ff, background:"none", border:"none", cursor:"pointer", padding:"4px 8px", borderRadius:"6px", transition:"all 100ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = "#111827"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#6B7280"; }}>
          View full post →
        </button>
      </div>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────

function ConfirmDialog({ action, onClose }: { action: { title: string; description: string; onConfirm: () => void } | null; onClose: () => void }) {
  return (
    <Dialog open={action !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent style={{ maxWidth:"380px", padding:0, borderRadius:"12px", border:"1px solid #EBEBEB", overflow:"hidden", fontFamily:ff }}>
        <div style={{ height:"3px", background:"linear-gradient(90deg,#DC2626,#F97316)" }} />
        <div style={{ padding:"18px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
            <div style={{ width:"34px", height:"34px", borderRadius:"8px", background:"#FEF2F2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <AlertTriangle style={{ width:"16px", height:"16px", color:"#DC2626" }} />
            </div>
            <div>
              <p style={{ fontSize:"14px", fontWeight:800, color:"#111827", margin:0, fontFamily:ff }}>{action?.title}</p>
              <p style={{ fontSize:"12px", color:"#9CA3AF", margin:"2px 0 0", fontFamily:ff }}>{action?.description}</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end", marginTop:"16px" }}>
            <button type="button" onClick={onClose}
              style={{ padding:"7px 16px", borderRadius:"7px", border:"1px solid #E5E7EB", background:"#FFF", color:"#6B7280", fontSize:"12.5px", fontWeight:600, fontFamily:ff, cursor:"pointer" }}>
              Cancel
            </button>
            <button type="button" onClick={() => { action?.onConfirm(); onClose(); }}
              style={{ padding:"7px 16px", borderRadius:"7px", border:"none", background:"#DC2626", color:"#FFF", fontSize:"12.5px", fontWeight:700, fontFamily:ff, cursor:"pointer" }}>
              Confirm
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function NewsManagement() {
  const [items,           setItems]           = useState<NewsItem[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [search,          setSearch]          = useState("");
  const [filterCommunity, setFilterCommunity] = useState("");
  const [page,            setPage]            = useState(1);
  const [totalPages,      setTotalPages]      = useState(1);
  const [total,           setTotal]           = useState(0);
  const [communities,     setCommunities]     = useState<CommunityListItem[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);

  const [viewItem,     setViewItem]     = useState<NewsItem | null>(null);
  const [confirmAction,setConfirmAction]= useState<{ title:string; description:string; onConfirm:()=>void } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [newsRes, comms] = await Promise.all([
        newsService.list({ page, limit:20, search:search.trim()||undefined, communityId:filterCommunity||undefined }),
        communityService.listCommunities(),
      ]);
      setItems(newsRes.data);
      setTotalPages(newsRes.meta.totalPages);
      setTotal(newsRes.meta.total);
      setCommunities(comms);
    } catch (e) { toast.error("Failed to load news", { description:errorMessage(e) }); }
    finally { setLoading(false); }
  }, [page, search, filterCommunity]);

  useEffect(() => { void load(); }, [load]);

  // Cleanup preview URL
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const openCreate = () => {
    setEditingId(null); setForm(EMPTY_FORM); setPreviewUrl(null); setIsDialogOpen(true);
  };
  const openEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setForm({ caption:item.caption, communityId:item.communityId||"", imageFile:null, existingImageFileId:item.imageFileId||"" });
    setPreviewUrl(null);
    setIsDialogOpen(true);
  };

  const handleFileChange = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setForm((f) => ({ ...f, imageFile: file }));
  };

  const resolveImageFileId = async (): Promise<string | null> => {
    if (form.imageFile) {
      const fd = new FormData();
      fd.append("file", form.imageFile);
      const res = await apiClient.post("/files/upload/service-attachment", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (!res.data?.id) throw new Error("Image uploaded but no file ID returned");
      return String(res.data.id);
    }
    return form.existingImageFileId || null;
  };

  const save = async () => {
    if (!form.caption.trim()) { toast.error("Caption is required"); return; }
    setSaving(true);
    try {
      const imageFileId = await resolveImageFileId();
      const payload: CreateNewsPayload = { caption:form.caption.trim(), imageFileId, communityId:form.communityId||undefined };
      if (editingId) { await newsService.update(editingId, payload); toast.success("Post updated"); }
      else           { await newsService.create(payload); toast.success("Post created"); }
      setIsDialogOpen(false);
      await load();
    } catch (e) { toast.error("Failed to save post", { description:errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const deleteItem = async (item: NewsItem) => {
    try { await newsService.remove(item.id); toast.success("Post deleted"); await load(); }
    catch (e) { toast.error("Failed to delete", { description:errorMessage(e) }); }
  };

  const hasImage = form.imageFile || form.existingImageFileId;

  return (
    <div style={{ fontFamily:ff }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px", marginBottom:"20px", flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontSize:"18px", fontWeight:900, color:"#111827", letterSpacing:"-0.02em", margin:0 }}>News & Updates</h1>
          <p style={{ marginTop:"4px", fontSize:"13px", color:"#6B7280" }}>Share updates with your community — like a social feed.</p>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <button type="button" onClick={() => void load()} disabled={loading}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 14px", borderRadius:"8px", background:"#FFF", color:"#374151", border:"1px solid #E5E7EB", cursor:loading?"not-allowed":"pointer", fontSize:"12.5px", fontWeight:600, fontFamily:ff, opacity:loading?0.6:1 }}>
            <RefreshCw style={{ width:"13px", height:"13px", animation:loading?"spin 1s linear infinite":"none" }} />
            {loading?"Refreshing…":"Refresh"}
          </button>
          <button type="button" onClick={openCreate}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px", borderRadius:"8px", background:"#111827", color:"#FFF", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:700, fontFamily:ff }}>
            <Plus style={{ width:"13px", height:"13px" }} /> New Post
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display:"flex", gap:"12px", marginBottom:"16px", flexWrap:"wrap" }}>
        <div style={{ borderRadius:"10px", border:"1px solid #EBEBEB", background:"#FFF", padding:"12px 18px", display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"36px", height:"36px", borderRadius:"9px", background:"#F0F9FF", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Pencil style={{ width:"15px", height:"15px", color:"#0284C7" }} />
          </div>
          <div>
            <p style={{ fontSize:"10.5px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.06em", margin:0, fontFamily:ff }}>Total Posts</p>
            <p style={{ fontSize:"22px", fontWeight:900, color:"#111827", margin:0, letterSpacing:"-0.02em", fontFamily:ff }}>{total}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ borderRadius:"10px", border:"1px solid #EBEBEB", background:"#FFF", padding:"9px 12px", display:"flex", alignItems:"center", gap:"8px", marginBottom:"18px", flexWrap:"wrap" }}>
        <Search style={{ width:"13px", height:"13px", color:"#9CA3AF", flexShrink:0 }} />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search posts…"
          style={{ flex:1, minWidth:"160px", border:"none", background:"transparent", outline:"none", fontSize:"13px", color:"#111827", fontFamily:ff }} />
        <select value={filterCommunity} onChange={(e) => { setFilterCommunity(e.target.value); setPage(1); }}
          style={{ ...selectStyle, width:"180px" }}>
          <option value="">All communities</option>
          {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Feed */}
      {loading && !items.length ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"14px", maxWidth:"640px" }}>
          {Array.from({length:3}).map((_,i) => (
            <div key={i} style={{ borderRadius:"14px", border:"1px solid #EBEBEB", background:"#FFF", padding:"16px", display:"flex", flexDirection:"column", gap:"10px" }}>
              <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
                <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize:"400% 100%", animation:"shimmer 1.4s ease infinite", flexShrink:0 }} />
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"6px" }}>
                  <div style={{ height:"13px", borderRadius:"4px", width:"140px", background:"linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize:"400% 100%", animation:"shimmer 1.4s ease infinite" }} />
                  <div style={{ height:"11px", borderRadius:"4px", width:"80px", background:"linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize:"400% 100%", animation:"shimmer 1.4s ease infinite" }} />
                </div>
              </div>
              <div style={{ height:"60px", borderRadius:"8px", background:"linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize:"400% 100%", animation:"shimmer 1.4s ease infinite" }} />
            </div>
          ))}
        </div>
      ) : !items.length ? (
        <div style={{ borderRadius:"14px", border:"2px dashed #E5E7EB", padding:"56px 24px", textAlign:"center" }}>
          <Pencil style={{ width:"28px", height:"28px", color:"#E5E7EB", margin:"0 auto 10px" }} />
          <p style={{ fontSize:"14px", fontWeight:700, color:"#9CA3AF", margin:0, fontFamily:ff }}>No posts yet</p>
          <p style={{ fontSize:"12.5px", color:"#D1D5DB", margin:"4px 0 0", fontFamily:ff }}>Click "New Post" to share something with the community.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"16px", maxWidth:"640px" }}>
          {items.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              onView={() => setViewItem(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => setConfirmAction({ title:"Delete Post", description:"This action cannot be undone.", onConfirm:() => void deleteItem(item) })}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", marginTop:"20px" }}>
          <button type="button" disabled={page<=1} onClick={() => setPage((p)=>Math.max(1,p-1))}
            style={{ padding:"6px 14px", borderRadius:"7px", border:"1px solid #E5E7EB", background:"#FFF", color:page<=1?"#D1D5DB":"#374151", fontSize:"12.5px", fontWeight:600, fontFamily:ff, cursor:page<=1?"not-allowed":"pointer" }}>
            ← Previous
          </button>
          <span style={{ fontSize:"12.5px", color:"#9CA3AF", fontFamily:ffMono }}>Page {page} of {totalPages}</span>
          <button type="button" disabled={page>=totalPages} onClick={() => setPage((p)=>p+1)}
            style={{ padding:"6px 14px", borderRadius:"7px", border:"1px solid #E5E7EB", background:"#FFF", color:page>=totalPages?"#D1D5DB":"#374151", fontSize:"12.5px", fontWeight:600, fontFamily:ff, cursor:page>=totalPages?"not-allowed":"pointer" }}>
            Next →
          </button>
        </div>
      )}

      {/* ── Create / Edit Dialog ────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) setIsDialogOpen(false); }}>
        <DialogContent style={{ maxWidth:"520px", padding:0, borderRadius:"14px", border:"1px solid #EBEBEB", overflow:"hidden", fontFamily:ff }}>
          <div style={{ height:"3px", background:"linear-gradient(90deg,#111827,#374151)" }} />

          <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid #F3F4F6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize:"15px", fontWeight:800, color:"#111827", fontFamily:ff }}>
                {editingId ? "Edit Post" : "New Post"}
              </DialogTitle>
              <p style={{ fontSize:"12px", color:"#9CA3AF", margin:"2px 0 0", fontFamily:ff }}>Share an update with your community.</p>
            </DialogHeader>
            <button type="button" onClick={() => setIsDialogOpen(false)}
              style={{ width:"28px", height:"28px", borderRadius:"6px", border:"none", background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#6B7280", flexShrink:0 }}>
              <X style={{ width:"12px", height:"12px" }} />
            </button>
          </div>

          {/* Composer area */}
          <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:"14px" }}>

            {/* Author preview strip */}
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Pencil style={{ width:"14px", height:"14px", color:"#9CA3AF" }} />
              </div>
              <div>
                <p style={{ fontSize:"12.5px", fontWeight:700, color:"#111827", margin:0 }}>Admin</p>
                <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"2px" }}>
                  <Globe style={{ width:"10px", height:"10px", color:"#9CA3AF" }} />
                  <span style={{ fontSize:"11px", color:"#9CA3AF", fontFamily:ff }}>
                    {form.communityId ? (communities.find((c)=>c.id===form.communityId)?.name||"Community") : "All communities"}
                  </span>
                </div>
              </div>
            </div>

            {/* Caption */}
            <div>
              <textarea value={form.caption} onChange={(e) => setForm((f)=>({...f,caption:e.target.value}))}
                placeholder="What's happening in the community?"
                rows={4}
                style={{ width:"100%", borderRadius:"10px", border:"1px solid #E5E7EB", background:"#FAFAFA", padding:"12px", fontFamily:ff, fontSize:"13.5px", color:"#111827", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.6 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#111827"; e.currentTarget.style.background = "#FFF"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#FAFAFA"; }} />
            </div>

            {/* Image preview */}
            {hasImage && (
              <div style={{ borderRadius:"10px", overflow:"hidden", border:"1px solid #E5E7EB", position:"relative" }}>
                {form.imageFile
                  ? <img src={previewUrl||""} alt="Preview" style={{ width:"100%", maxHeight:"240px", objectFit:"cover", display:"block" }} />
                  : form.existingImageFileId
                    ? <AuthImage src={form.existingImageFileId} style={{ width:"100%", maxHeight:"240px", objectFit:"cover", display:"block" }} alt="Preview" />
                    : null
                }
                <button type="button"
                  onClick={() => setConfirmAction({ title:"Remove Image", description:"Remove this image? Click Post to apply.", onConfirm:() => { handleFileChange(null); setForm((f)=>({...f,imageFile:null,existingImageFileId:""})); } })}
                  style={{ position:"absolute", top:"8px", right:"8px", width:"28px", height:"28px", borderRadius:"50%", background:"rgba(0,0,0,0.55)", border:"none", cursor:"pointer", color:"#FFF", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <X style={{ width:"12px", height:"12px" }} />
                </button>
              </div>
            )}

            {/* Toolbar */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px", padding:"10px 12px", borderRadius:"10px", border:"1px solid #F3F4F6", background:"#FAFAFA" }}>
              <div style={{ display:"flex", gap:"6px" }}>
                {/* Image upload */}
                <label style={{ display:"flex", alignItems:"center", gap:"5px", padding:"6px 11px", borderRadius:"7px", border:"1px solid #E5E7EB", background:"#FFF", color:"#374151", fontSize:"12px", fontWeight:600, fontFamily:ff, cursor:"pointer", whiteSpace:"nowrap" }}>
                  <ImageIcon style={{ width:"12px", height:"12px", color:"#059669" }} />
                  Photo
                  <input type="file" accept="image/*" style={{ display:"none" }}
                    onChange={(e) => handleFileChange(e.target.files?.[0]??null)} />
                </label>
                {/* Community */}
                <select value={form.communityId} onChange={(e)=>setForm((f)=>({...f,communityId:e.target.value}))}
                  style={{ ...selectStyle, width:"auto", paddingLeft:"8px", paddingRight:"8px", height:"32px", background:"#FFF", fontSize:"12px" }}>
                  <option value="">All communities</option>
                  {communities.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Post button */}
              <button type="button" onClick={() => void save()} disabled={saving||!form.caption.trim()}
                style={{ padding:"7px 20px", borderRadius:"7px", border:"none", background:"#111827", color:"#FFF", fontSize:"13px", fontWeight:700, fontFamily:ff, cursor:saving||!form.caption.trim()?"not-allowed":"pointer", opacity:!form.caption.trim()?0.4:1, transition:"opacity 120ms", whiteSpace:"nowrap" }}>
                {saving ? "Posting…" : editingId ? "Save Changes" : "Post"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View dialog ─────────────────────────────────────── */}
      <Dialog open={viewItem !== null} onOpenChange={(o) => { if (!o) setViewItem(null); }}>
        <DialogContent style={{ maxWidth:"540px", padding:0, borderRadius:"14px", border:"1px solid #EBEBEB", overflow:"hidden", fontFamily:ff }}>
          {viewItem && (
            <>
              {/* Author header */}
              <div style={{ padding:"14px 16px 10px", display:"flex", alignItems:"center", gap:"10px", borderBottom:"1px solid #F3F4F6" }}>
                <Avatar name={viewItem.authorName||"?"} src={viewItem.authorPhotoUrl} size={40} />
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:"13.5px", fontWeight:700, color:"#111827", margin:0, fontFamily:ff }}>{viewItem.authorName||"Unknown"}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"2px" }}>
                    <span style={{ fontSize:"11px", color:"#9CA3AF", fontFamily:ffMono }}>
                      {new Date(viewItem.createdAt).toLocaleString()}
                    </span>
                    {viewItem.communityName && (
                      <span style={{ fontSize:"10.5px", fontWeight:700, padding:"1px 7px", borderRadius:"20px", background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", fontFamily:ff }}>
                        {viewItem.communityName}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => setViewItem(null)}
                  style={{ width:"28px", height:"28px", borderRadius:"6px", border:"none", background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#6B7280", flexShrink:0 }}>
                  <X style={{ width:"12px", height:"12px" }} />
                </button>
              </div>

              {/* Caption */}
              <div style={{ padding:"14px 16px" }}>
                <p style={{ fontSize:"14px", color:"#374151", margin:0, lineHeight:1.7, whiteSpace:"pre-wrap", fontFamily:ff }}>{viewItem.caption}</p>
              </div>

              {/* Image */}
              {viewItem.imageFileId && (
                <AuthImage src={viewItem.imageFileId} style={{ width:"100%", maxHeight:"400px", objectFit:"cover", display:"block", borderTop:"1px solid #F3F4F6" }} />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <ConfirmDialog action={confirmAction} onClose={() => setConfirmAction(null)} />

      <style>{`
        @keyframes shimmer { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}