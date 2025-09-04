import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Users, Trophy, Plus, Phone, BarChart3, Settings, Home, X, Trash2, Edit3, Bell, UserCheck } from "lucide-react";
import { api } from "./api";
import {
  listUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
} from "./services/users";
import {
  listLeads,
  createLead as apiCreateLead,
  updateLead as apiUpdateLead,
  deleteLead as apiDeleteLead,
} from "./services/leads";

// ===== Utilidades de jerarquía =====
function buildIndex(users: any[]) {
  const byId = new Map(users.map((u: any) => [u.id, u]));
  const children = new Map<number, number[]>();
  users.forEach((u: any) => children.set(u.id, []));
  users.forEach((u: any) => {
    if (u.reportsTo) (children.get(u.reportsTo) as number[] | undefined)?.push(u.id);
  });
  return { byId, children };
}

function getDescendantUserIds(rootId: number, childrenIndex: Map<number, number[]>) {
  const out: number[] = [];
  const stack = [...(childrenIndex.get(rootId) || [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    const kids = childrenIndex.get(id) || [];
    for (const k of kids) stack.push(k);
  }
  return out;
}

const roles: Record<string, string> = {
  owner: "Dueño",
  director: "Director",
  gerente: "Gerente",
  supervisor: "Supervisor",
  vendedor: "Vendedor",
};

const estados: Record<string, { label: string; color: string }> = {
  nuevo: { label: "Nuevo", color: "bg-blue-500" },
  contactado: { label: "Contactado", color: "bg-yellow-500" },
  interesado: { label: "Interesado", color: "bg-orange-500" },
  negociacion: { label: "Negociación", color: "bg-purple-500" },
  vendido: { label: "Vendido", color: "bg-green-600" },
  perdido: { label: "Perdido", color: "bg-red-500" },
  numero_invalido: { label: "Número inválido", color: "bg-gray-500" },
  no_contesta_1: { label: "No contesta 1", color: "bg-amber-500" },
  no_contesta_2: { label: "No contesta 2", color: "bg-orange-600" },
  no_contesta_3: { label: "No contesta 3", color: "bg-red-600" },
};

const fuentes: Record<string, { label: string; color: string; icon: string }> = {
  meta: { label: "Meta/Facebook", color: "bg-blue-600", icon: "📱" },
  whatsapp: { label: "WhatsApp Bot", color: "bg-green-500", icon: "💬" },
  whatsapp_100: { label: "WhatsApp Bot 100", color: "bg-green-700", icon: "💬" },
  sitio_web: { label: "Sitio Web", color: "bg-purple-600", icon: "🌐" },
  referido: { label: "Referido", color: "bg-orange-500", icon: "👥" },
  telefono: { label: "Llamada", color: "bg-indigo-500", icon: "📞" },
  showroom: { label: "Showroom", color: "bg-gray-600", icon: "🏢" },
  google: { label: "Google Ads", color: "bg-red-500", icon: "🎯" },
  instagram: { label: "Instagram", color: "bg-pink-500", icon: "📸" },
  otro: { label: "Otro", color: "bg-gray-400", icon: "❓" },
};

type LeadRow = {
  id: number;
  nombre: string;
  telefono: string;
  modelo: string;
  formaPago?: string;
  infoUsado?: string;
  entrega?: boolean;
  fecha?: string;
  estado: keyof typeof estados;
  vendedor: number | null;
  notas?: string;
  fuente: keyof typeof fuentes | string;
  historial?: Array<{
    estado: string;
    timestamp: string;
    usuario: string;
  }>;
};

type Alert = {
  id: number;
  userId: number;
  type: "lead_assigned" | "ranking_change";
  message: string;
  ts: string;
  read: boolean;
};

export default function CRM() {
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const { byId: userById, children: childrenIndex } = useMemo(() => buildIndex(users), [users]);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState<"dashboard" | "leads" | "calendar" | "ranking" | "users" | "alerts" | "team">("dashboard");
  const [loginError, setLoginError] = useState("");
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'roberto' | 'daniel'>('roberto');

  // ===== Login contra backend =====
  const handleLogin = async (email: string, password: string) => {
    try {
      const r = await api.post("/auth/login", { email, password });
      
      // Verificar respuesta exitosa
      if (r.data?.ok && r.data?.token) {
        // Guardar token
        localStorage.setItem('token', r.data.token);
        localStorage.setItem('user', JSON.stringify(r.data.user));
        
        // Configurar axios para futuras peticiones
        api.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`;
        
        const u = r.data.user || {
          id: 0,
          name: r.data?.user?.email || email,
          email,
          role: r.data?.user?.role || "owner",
          reportsTo: null,
          active: true,
        };
        
        setCurrentUser(u);
        setIsAuthenticated(true);
        setLoginError("");

        // Cargar datos
        const [uu, ll] = await Promise.all([listUsers(), listLeads()]);
        const mappedLeads: LeadRow[] = (ll || []).map((L: any) => ({
          id: L.id,
          nombre: L.nombre,
          telefono: L.telefono,
          modelo: L.modelo,
          formaPago: L.formaPago,
          infoUsado: L.infoUsado,
          entrega: L.entrega,
          fecha: L.fecha || L.created_at || "",
          estado: (L.estado || "nuevo") as LeadRow["estado"],
          vendedor: L.assigned_to ?? null,
          notas: L.notas || "",
          fuente: (L.fuente || "otro") as LeadRow["fuente"],
          historial: L.historial || [],
        }));
        setUsers(uu || []);
        setLeads(mappedLeads);
      } else {
        throw new Error("Respuesta inválida del servidor");
      }
    } catch (err: any) {
      setLoginError(err?.response?.data?.error || "Credenciales incorrectas");
      setIsAuthenticated(false);
    }
  };

  // ===== Acceso por rol =====
  const getAccessibleUserIds = (user: any) => {
    if (!user) return [] as number[];
    if (["owner", "director"].includes(user.role)) return users.map((u: any) => u.id);
    const ids = [user.id, ...getDescendantUserIds(user.id, childrenIndex)];
    return ids;
  };
  const canManageUsers = () => currentUser && ["owner", "director", "gerente"].includes(currentUser.role);
  const isOwner = () => currentUser?.role === "owner";

  // ===== Round-robin =====
  const [rrIndex, setRrIndex] = useState(0);
  const getActiveVendorIdsInScope = (scopeUser?: any) => {
    if (!scopeUser) return [] as number[];
    const scope = getAccessibleUserIds(scopeUser);
    return users.filter((u: any) => u.role === "vendedor" && u.active && scope.includes(u.id)).map((u: any) => u.id);
  };
  const pickNextVendorId = (scopeUser?: any) => {
    const pool = getActiveVendorIdsInScope(scopeUser || currentUser);
    if (pool.length === 0) return null;
    const id = pool[rrIndex % pool.length];
    setRrIndex((i) => i + 1);
    return id;
  };

  // ===== Alertas (locales de UI) =====
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const nextAlertId = useRef(1);
  const pushAlert = (userId: number, type: Alert["type"], message: string) => {
    setAlerts((prev) => [...prev, { id: nextAlertId.current++, userId, type, message, ts: new Date().toISOString(), read: false }]);
  };
  const pushAlertToChain = (vendorId: number, type: Alert["type"], message: string) => {
    pushAlert(vendorId, type, message);
    const sup = users.find((u: any) => u.id === userById.get(vendorId)?.reportsTo);
    if (sup) pushAlert(sup.id, type, message);
    const gerente = sup ? users.find((u: any) => u.id === sup.reportsTo) : null;
    if (gerente) pushAlert(gerente.id, type, message);
  };
  const unreadCount = (uid: number) => alerts.filter((a) => a.userId === uid && !a.read).length;

  // ===== Filtrados y ranking =====
  const visibleUserIds = useMemo(() => getAccessibleUserIds(currentUser), [currentUser, users]);

  const getFilteredLeads = () => {
    if (!currentUser) return [] as LeadRow[];
    return leads.filter((l) => (l.vendedor ? visibleUserIds.includes(l.vendedor) : true));
  };

  const getRanking = () => {
    const vendedores = users.filter((u: any) => u.role === "vendedor");
    return vendedores
      .map((v: any) => {
        const ventas = leads.filter((l) => l.vendedor === v.id && l.estado === "vendido").length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return { id: v.id, nombre: v.name, ventas, leadsAsignados, team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}` };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  const getRankingInScope = () => {
    const vendedores = users.filter((u: any) => u.role === "vendedor" && visibleUserIds.includes(u.id));
    return vendedores
      .map((v: any) => {
        const ventas = leads.filter((l) => l.vendedor === v.id && l.estado === "vendido").length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return { id: v.id, nombre: v.name, ventas, leadsAsignados, team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}` };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  const prevRankingRef = useRef(new Map<number, number>());
  useEffect(() => {
    const r = getRanking();
    const curr = new Map<number, number>();
    r.forEach((row, idx) => curr.set(row.id, idx + 1));
    const prev = prevRankingRef.current;
    curr.forEach((pos, vid) => {
      const before = prev.get(vid);
      if (before && before !== pos) {
        const delta = before - pos;
        const msg = delta > 0 ? `¡Subiste ${Math.abs(delta)} puesto(s) en el ranking!` : `Bajaste ${Math.abs(delta)} puesto(s) en el ranking.`;
        pushAlertToChain(vid, "ranking_change", msg);
      }
    });
    prevRankingRef.current = curr;
  }, [leads, users, userById]);

  const getDashboardStats = () => {
    const filteredLeads = getFilteredLeads();
    const vendidos = filteredLeads.filter((lead) => lead.estado === "vendido").length;
    const conversion = filteredLeads.length > 0 ? ((vendidos / filteredLeads.length) * 100).toFixed(1) : 0;
    return { totalLeads: filteredLeads.length, vendidos, conversion };
  };

  const getSourceMetrics = () => {
    const filteredLeads = getFilteredLeads();
    const sourceData = Object.keys(fuentes)
      .map((source) => {
        const sourceLeads = filteredLeads.filter((lead) => lead.fuente === source);
        const vendidos = sourceLeads.filter((lead) => lead.estado === "vendido").length;
        const conversion = sourceLeads.length > 0 ? ((vendidos / sourceLeads.length) * 100).toFixed(1) : "0";
        return {
          source,
          total: sourceLeads.length,
          vendidos,
          conversion: parseFloat(conversion),
          ...fuentes[source],
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    return sourceData;
  };

  // ===== Acciones de Leads (API) =====
  const mapLeadFromApi = (L: any): LeadRow => ({
    id: L.id,
    nombre: L.nombre,
    telefono: L.telefono,
    modelo: L.modelo,
    formaPago: L.formaPago,
    infoUsado: L.infoUsado,
    entrega: L.entrega,
    fecha: L.fecha || L.created_at || "",
    estado: (L.estado || "nuevo") as LeadRow["estado"],
    vendedor: L.assigned_to ?? null,
    notas: L.notas || "",
    fuente: (L.fuente || "otro") as LeadRow["fuente"],
    historial: L.historial || [],
  });

  const addHistorialEntry = (leadId: number, estado: string) => {
    if (!currentUser) return;
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? {
            ...lead,
            historial: [
              ...(lead.historial || []),
              {
                estado,
                timestamp: new Date().toISOString(),
                usuario: currentUser.name
              }
            ]
          }
        : lead
    ));
  };

  const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { estado: newStatus });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l)));
      
      // Agregar entrada al historial
      addHistorialEntry(leadId, newStatus);
    } catch (e) {
      console.error("No pude actualizar estado del lead", e);
    }
  };

  // ===== Crear Lead y Modales =====
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showObservacionesModal, setShowObservacionesModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [editingLeadObservaciones, setEditingLeadObservaciones] = useState<LeadRow | null>(null);
  const [viewingLeadHistorial, setViewingLeadHistorial] = useState<LeadRow | null>(null);

  const handleUpdateObservaciones = async (leadId: number, observaciones: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { notas: observaciones });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l)));
      setShowObservacionesModal(false);
      setEditingLeadObservaciones(null);
    } catch (e) {
      console.error("No pude actualizar observaciones del lead", e);
    }
  };

  const handleCreateLead = async () => {
    const nombre = (document.getElementById("new-nombre") as HTMLInputElement).value.trim();
    const telefono = (document.getElementById("new-telefono") as HTMLInputElement).value.trim();
    const modelo = (document.getElementById("new-modelo") as HTMLInputElement).value.trim();
    const formaPago = (document.getElementById("new-formaPago") as HTMLSelectElement).value;
    const infoUsado = (document.getElementById("new-infoUsado") as HTMLInputElement).value.trim();
    const entrega = (document.getElementById("new-entrega") as HTMLInputElement).checked;
    const fecha = (document.getElementById("new-fecha") as HTMLInputElement).value;
    const fuente = (document.getElementById("new-fuente") as HTMLSelectElement).value;
    const autoAssign = (document.getElementById("new-autoassign") as HTMLInputElement)?.checked;
    const vendedorSelVal = (document.getElementById("new-vendedor") as HTMLSelectElement).value;

    const vendedorIdSelRaw = parseInt(vendedorSelVal, 10);
    const vendedorIdSel = Number.isNaN(vendedorIdSelRaw) ? null : vendedorIdSelRaw;
    const vendedorId = autoAssign ? pickNextVendorId(currentUser) ?? vendedorIdSel ?? null : vendedorIdSel ?? null;

    if (nombre && telefono && modelo && fuente) {
      try {
        const created = await apiCreateLead({
          nombre,
          telefono,
          modelo,
          formaPago,
          notas: "",
          estado: "nuevo",
          fuente,
          infoUsado,
          entrega,
          fecha,
          vendedor: vendedorId, // backend: assigned_to
        } as any);
        const mapped = mapLeadFromApi(created);
        if (mapped.vendedor) pushAlert(mapped.vendedor, "lead_assigned", `Nuevo lead asignado: ${mapped.nombre}`);
        setLeads((prev) => [mapped, ...prev]);
        setShowNewLeadModal(false);
        
        // Agregar entrada inicial al historial
        addHistorialEntry(mapped.id, "nuevo");
      } catch (e) {
        console.error("No pude crear el lead", e);
      }
    }
  };

  // ===== Calendario (UI local) =====
  const [events, setEvents] = useState<any[]>([]);
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState<number | null>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const visibleUsers = useMemo(
    () => (currentUser ? users.filter((u: any) => getAccessibleUserIds(currentUser).includes(u.id)) : []),
    [currentUser, users]
  );
  const eventsForSelectedUser = useMemo(() => {
    const uid = selectedCalendarUserId || currentUser?.id;
    return events
      .filter((e) => e.userId === uid)
      .sort((a, b) => ((a.date + (a.time || "")) > (b.date + (b.time || "")) ? 1 : -1));
  }, [events, selectedCalendarUserId, currentUser]);
  const formatterEs = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "2-digit", month: "long" });

  const createEvent = () => {
    const title = (document.getElementById("ev-title") as HTMLInputElement).value;
    const date = (document.getElementById("ev-date") as HTMLInputElement).value;
    const time = (document.getElementById("ev-time") as HTMLInputElement).value;
    const userId = parseInt((document.getElementById("ev-user") as HTMLSelectElement).value, 10);
    if (title && date && userId) {
      setEvents((prev) => [...prev, { id: Math.max(0, ...prev.map((e: any) => e.id)) + 1, title, date, time: time || "09:00", userId }]);
      setShowNewEventModal(false);
    }
  };
  const deleteEvent = (id: number) => setEvents((prev) => prev.filter((e: any) => e.id !== id));

  // ===== Gestión de Usuarios (API) =====
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [modalRole, setModalRole] = useState<"owner" | "director" | "gerente" | "supervisor" | "vendedor">("vendedor");
  const [modalReportsTo, setModalReportsTo] = useState<number | null>(null);

  const validRolesByUser = (user: any) => {
    if (!user) return [];
    switch (user.role) {
      case "owner":
        return ["director", "gerente", "supervisor", "vendedor"];
      case "director":
        return ["gerente", "supervisor", "vendedor"];
      case "gerente":
        return ["supervisor", "vendedor"];
      default:
        return [];
    }
  };
  const validManagersByRole = (role: string) => {
    switch (role) {
      case "owner":
        return [];
      case "director":
        return users.filter((u: any) => u.role === "owner");
      case "gerente":
        return users.filter((u: any) => u.role === "director");
      case "supervisor":
        return users.filter((u: any) => u.role === "gerente");
      case "vendedor":
        return users.filter((u: any) => u.role === "supervisor");
      default:
        return [];
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    const availableRoles = validRolesByUser(currentUser);
    const roleDefault = (availableRoles?.[0] as typeof modalRole) || "vendedor";
    const managers = validManagersByRole(roleDefault);
    setModalRole(roleDefault);
    setModalReportsTo(managers[0]?.id ?? null);
    setShowUserModal(true);
  };

  const openEditUser = (u: any) => {
    setEditingUser(u);
    const roleCurrent = u.role as typeof modalRole;
    const availableRoles: string[] =
      currentUser.role === "owner" && u.id === currentUser.id
        ? ["owner", ...validRolesByUser(currentUser)]
        : validRolesByUser(currentUser);
    const roleToSet = availableRoles.includes(roleCurrent) ? roleCurrent : (availableRoles[0] as any);
    const managers = validManagersByRole(roleToSet);
    setModalRole(roleToSet as any);
    setModalReportsTo(roleToSet === "owner" ? null : u.reportsTo ?? managers[0]?.id ?? null);
    setShowUserModal(true);
  };

  const saveUser = async () => {
    const name = (document.getElementById("u-name") as HTMLInputElement).value.trim();
    const email = (document.getElementById("u-email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("u-pass") as HTMLInputElement).value;
    if (!name || !email) return;
    const finalReportsTo = modalRole === "owner" ? null : modalReportsTo ?? null;

    try {
      if (editingUser) {
        const updated = await apiUpdateUser(editingUser.id, {
          name,
          email,
          password: password || undefined,
          role: modalRole,
          reportsTo: finalReportsTo,
          active: editingUser.active,
        });
        setUsers((prev) => prev.map((u: any) => (u.id === editingUser.id ? updated : u)));
      } else {
        const created = await apiCreateUser({
          name,
          email,
          password: password || "123456",
          role: modalRole,
          reportsTo: finalReportsTo,
          active: 1,
        } as any);
        setUsers((prev) => [...prev, created]);
      }
      setShowUserModal(false);
    } catch (e) {
      console.error("No pude guardar usuario", e);
    }
  };

  const deleteUser = async (id: number) => {
    const target = users.find((u: any) => u.id === id);
    if (!target) return;
    if (target.role === "owner") {
      alert("No podés eliminar al Dueño.");
      return;
    }
    const hasChildren = users.some((u: any) => u.reportsTo === id);
    if (hasChildren) {
      alert("No se puede eliminar: el usuario tiene integrantes a cargo.");
      return;
    }
    try {
      await apiDeleteUser(id);
      setUsers((prev) => prev.filter((u: any) => u.id !== id));
    } catch (e) {
      console.error("No pude eliminar usuario", e);
    }
  };

  // ===== UI: Login =====
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <svg width="48" height="42" viewBox="0 0 40 36" fill="none">
                <path d="M10 2L30 2L35 12L30 22L10 22L5 12Z" fill="url(#gradient2)" />
                <defs>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFB800" />
                    <stop offset="25%" stopColor="#FF6B9D" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="75%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-800">Alluma</h1>
                <p className="text-sm text-gray-600">Publicidad</p>
              </div>
            </div>
            <p className="text-gray-600">Sistema de gestión CRM</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input type="email" id="email" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="tu@alluma.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <input type="password" id="password" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
            </div>
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{loginError}</p>
              </div>
            )}
            <button
              onClick={() =>
                handleLogin(
                  (document.getElementById("email") as HTMLInputElement).value,
                  (document.getElementById("password") as HTMLInputElement).value
                )
              }
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== UI autenticada =====
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="bg-slate-900 text-white w-64 min-h-screen p-4">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="relative">
              <svg width="40" height="36" viewBox="0 0 40 36" fill="none">
                <path d="M10 2L30 2L35 12L30 22L10 22L5 12Z" fill="url(#gradient1)" />
                <defs>
                  <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFB800" />
                    <stop offset="25%" stopColor="#FF6B9D" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="75%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold text-white">Alluma</h1>
              <p className="text-xs text-gray-400">Publicidad</p>
            </div>
          </div>

          <div className="text-sm text-gray-300">
            <p>{currentUser?.name || currentUser?.email}</p>
            <p className="text-blue-300">{roles[currentUser?.role] || currentUser?.role}</p>
          </div>
        </div>
        <nav className="space-y-2">
          {[
            { key: "dashboard", label: "Dashboard", Icon: Home },
            { key: "leads", label: "Leads", Icon: Users },
            { key: "calendar", label: "Calendario", Icon: Calendar },
            { key: "ranking", label: "Ranking", Icon: Trophy },
            ...(["supervisor", "gerente", "director", "owner"].includes(currentUser?.role) ? [{ key: "team", label: "Mi Equipo", Icon: UserCheck }] : []),
            ...(canManageUsers() ? [{ key: "users", label: "Usuarios", Icon: Settings }] : []),
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as any)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === (key as any) ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-slate-800"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div className="flex-1 p-6">
        {/* Modal: Observaciones del Lead */}
        {showObservacionesModal && editingLeadObservaciones && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Observaciones - {editingLeadObservaciones.nombre}
                </h3>
                <button onClick={() => {
                  setShowObservacionesModal(false);
                  setEditingLeadObservaciones(null);
                }}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Cliente:</span> {editingLeadObservaciones.nombre} | 
                  <span className="font-medium ml-2">Teléfono:</span> {editingLeadObservaciones.telefono} | 
                  <span className="font-medium ml-2">Vehículo:</span> {editingLeadObservaciones.modelo}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Estado actual:</span> 
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium text-white ${estados[editingLeadObservaciones.estado].color}`}>
                    {estados[editingLeadObservaciones.estado].label}
                  </span>
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
                <textarea
                  id="observaciones-textarea"
                  defaultValue={editingLeadObservaciones.notas || ""}
                  placeholder="Agregar observaciones sobre el cliente, llamadas realizadas, intereses, objeciones, etc..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex space-x-3 pt-6">
                <button 
                  onClick={() => {
                    const textarea = document.getElementById("observaciones-textarea") as HTMLTextAreaElement;
                    if (textarea && editingLeadObservaciones) {
                      handleUpdateObservaciones(editingLeadObservaciones.id, textarea.value);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Guardar Observaciones
                </button>
                <button 
                  onClick={() => {
                    setShowObservacionesModal(false);
                    setEditingLeadObservaciones(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Nuevo Lead */}
        {showNewLeadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-3xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">Nuevo Lead</h3>
                <button onClick={() => setShowNewLeadModal(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" id="new-nombre" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="text" id="new-telefono" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                  <input type="text" id="new-modelo" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pago</label>
                  <select id="new-formaPago" className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="Contado">Contado</option>
                    <option value="Financiado">Financiado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuente del Lead</label>
                  <select id="new-fuente" className="w-full px-3 py-2 border border-gray-300 rounded-lg" defaultValue="sitio_web">
                    {Object.entries(fuentes).map(([key, fuente]) => (
                      <option key={key} value={key}>
                        {fuente.icon} {fuente.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Info Usado</label>
                  <input type="text" id="new-infoUsado" placeholder="Marca Modelo Año" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" id="new-fecha" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="col-span-2 flex items-center space-x-3">
                  <input type="checkbox" id="new-entrega" className="rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-700">Entrega de vehículo usado</span>
                </div>
                <div className="col-span-2 flex items-center space-x-3">
                  <input type="checkbox" id="new-autoassign" defaultChecked className="rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-700">Asignación automática y equitativa a vendedores activos</span>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a vendedor (opcional)</label>
                  <select id="new-vendedor" className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Sin asignar</option>
                    {users
                      .filter((u: any) => u.role === "vendedor" && visibleUserIds.includes(u.id))
                      .map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.active ? "" : "(inactivo)"}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Si está tildado "Asignación automática", se ignorará esta selección.</p>
                </div>
              </div>
              <div className="flex space-x-3 pt-6">
                <button onClick={() => setShowNewLeadModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleCreateLead} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Crear Lead
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Nuevo Evento */}
        {showNewEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">Nuevo evento</h3>
                <button onClick={() => setShowNewEventModal(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                  <input type="text" id="ev-title" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" id="ev-date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                  <input type="time" id="ev-time" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                  <select id="ev-user" defaultValue={selectedCalendarUserId ?? currentUser?.id} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    {visibleUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {roles[u.role] || u.role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex space-x-3 pt-6">
                <button onClick={createEvent} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Crear evento
                </button>
                <button onClick={() => setShowNewEventModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Crear/Editar Usuario */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">{editingUser ? "Editar usuario" : "Nuevo usuario"}</h3>
                <button onClick={() => setShowUserModal(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" id="u-name" defaultValue={editingUser?.name || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" id="u-email" defaultValue={editingUser?.email || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <input type="password" id="u-pass" placeholder={editingUser ? "(sin cambio)" : ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    id="u-role"
                    value={modalRole}
                    onChange={(e) => {
                      const r = e.target.value as typeof modalRole;
                      setModalRole(r);
                      const managers = validManagersByRole(r);
                      setModalReportsTo(r === "owner" ? null : managers[0]?.id ?? null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {currentUser?.role === "owner" && editingUser?.id === currentUser?.id && <option value="owner">{roles["owner"]}</option>}
                    {validRolesByUser(currentUser).map((role) => (
                      <option key={role} value={role}>
                        {roles[role]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reporta a</label>
                  <select
                    id="u-reportsTo"
                    value={modalReportsTo ?? ""}
                    onChange={(e) => setModalReportsTo(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={modalRole === "owner"}
                  >
                    {modalRole === "owner" ? (
                      <option value="">N/A - Dueño</option>
                    ) : (
                      validManagersByRole(modalRole).map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {roles[m.role] || m.role}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 pt-6">
                <button onClick={saveUser} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Guardar
                </button>
                <button onClick={() => setShowUserModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} Topbar con alertas */}
        <div className="flex items-center justify-end mb-4">
          <div className="relative">
            <button onClick={() => setActiveSection("alerts")} className="p-2 rounded-lg hover:bg-gray-200 relative">
              <Bell size={20} />
              {currentUser && unreadCount(currentUser.id) > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1">
                  {unreadCount(currentUser.id)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Dashboard con selector de equipo para Owner/Director */}
        {activeSection === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
              {["owner", "director"].includes(currentUser?.role) && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value as 'roberto' | 'daniel')}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="roberto">Equipo Roberto</option>
                  <option value="daniel">Equipo Daniel</option>
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(() => {
                const stats = getDashboardStats();
                const cards = [
                  { label: "Total Leads", value: stats.totalLeads, Icon: Users },
                  { label: "Vendidos", value: stats.vendidos, Icon: BarChart3 },
                  { label: "Conversión", value: stats.conversion + "%", Icon: BarChart3 },
                ];
                return cards.map(({ label, value, Icon }, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm font-medium">{label}</p>
                        <p className="text-3xl font-bold text-gray-800">{value}</p>
                      </div>
                      <Icon className="text-blue-500" size={32} />
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Leads por Estado</h3>
                {selectedEstado && (
                  <button 
                    onClick={() => setSelectedEstado(null)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <X size={16} />
                    <span>Cerrar filtro</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(estados).map(([key, estado]) => {
                  const count = getFilteredLeads().filter((l) => l.estado === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                      className={`text-center transition-all duration-200 transform hover:scale-105 ${
                        selectedEstado === key ? "ring-4 ring-blue-300 ring-opacity-50" : ""
                      }`}
                      title={`Ver todos los leads en estado: ${estado.label}`}
                    >
                      <div className={`${estado.color} text-white rounded-lg p-4 mb-2 hover:opacity-90`}>
                        <div className="text-2xl font-bold">{count}</div>
                      </div>
                      <div className="text-sm text-gray-600">{estado.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Lista filtrada de leads por estado */}
              {selectedEstado && (
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">
                    Leads en estado: <span className={`px-3 py-1 rounded-full text-white text-sm ${estados[selectedEstado].color}`}>
                      {estados[selectedEstado].label}
                    </span>
                  </h4>
                  
                  {(() => {
                    const leadsFiltrados = getFilteredLeads().filter(l => l.estado === selectedEstado);
                    
                    if (leadsFiltrados.length === 0) {
                      return (
                        <p className="text-gray-500 text-center py-8">
                          No hay leads en estado "{estados[selectedEstado].label}"
                        </p>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {leadsFiltrados.map((lead) => {
                              const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                              return (
                                <tr key={lead.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2">
                                    <div className="font-medium text-gray-900">{lead.nombre}</div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center space-x-1">
                                      <Phone size={12} className="text-gray-400" />
                                      <span className="text-gray-700">{lead.telefono}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div>
                                      <div className="font-medium text-gray-900">{lead.modelo}</div>
                                      <div className="text-xs text-gray-500">{lead.formaPago}</div>
                                      {lead.infoUsado && <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center space-x-1">
                                      <span className="text-sm">{fuentes[lead.fuente as string]?.icon || "❓"}</span>
                                      <span className="text-xs text-gray-600">
                                        {fuentes[lead.fuente as string]?.label || String(lead.fuente)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-gray-700">
                                    {vendedor?.name || "Sin asignar"}
                                  </td>
                                  <td className="px-4 py-2 text-gray-500 text-xs">
                                    {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <div className="flex items-center justify-center space-x-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingLeadObservaciones(lead);
                                          setShowObservacionesModal(true);
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                        title="Ver/Editar observaciones"
                                      >
                                        {lead.notas && lead.notas.length > 0 ? "Ver" : "Obs"}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveSection("leads");
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        title="Ver en tabla completa"
                                      >
                                        Ver
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {["owner", "director", "gerente"].includes(currentUser?.role) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Rendimiento por Fuente de Lead</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getSourceMetrics().map((source) => (
                    <div key={source.source} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">{source.icon}</span>
                          <h4 className="font-medium text-gray-800">{source.label}</h4>
                        </div>
                        <span className={`${source.color} text-white px-2 py-1 rounded-full text-xs font-bold`}>{source.conversion}%</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total leads:</span>
                          <span className="font-medium">{source.total}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Vendidos:</span>
                          <span className="font-medium text-green-600">{source.vendidos}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className={`${source.color} h-2 rounded-full`} style={{ width: `${source.conversion}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {getSourceMetrics().length === 0 && <p className="text-gray-500 text-center py-8">No hay leads con fuentes registradas</p>}
              </div>
            )}
          </div>
        )}

        {/* Mi Equipo - Vista jerárquica para Supervisores, Gerentes, Directores y Dueño */}
        {activeSection === "team" && ["supervisor", "gerente", "director", "owner"].includes(currentUser?.role || "") && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">
              {currentUser?.role === "supervisor" && "Mi Equipo de Vendedores"}
              {currentUser?.role === "gerente" && "Mi Organización"}
              {currentUser?.role === "director" && "Mi División"}
              {currentUser?.role === "owner" && "Organización Completa"}
            </h2>
            
            {/* Estadísticas generales del equipo */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {(() => {
                const accessibleIds = getAccessibleUserIds(currentUser);
                const miEquipo = users.filter((u: any) => accessibleIds.includes(u.id) && u.id !== currentUser.id);
                const totalLeadsEquipo = leads.filter((l) => l.vendedor && accessibleIds.includes(l.vendedor)).length;
                const vendidosEquipo = leads.filter((l) => l.vendedor && accessibleIds.includes(l.vendedor) && l.estado === "vendido").length;
                const conversionEquipo = totalLeadsEquipo > 0 ? ((vendidosEquipo / totalLeadsEquipo) * 100).toFixed(1) : "0";
                
                // Contadores por rol
                const roleCounts = {
                  gerente: miEquipo.filter(u => u.role === "gerente").length,
                  supervisor: miEquipo.filter(u => u.role === "supervisor").length,
                  vendedor: miEquipo.filter(u => u.role === "vendedor").length,
                };
                
                return (
                  <>
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-sm text-gray-600">Personal Total</p>
                      <p className="text-2xl font-bold">{miEquipo.length}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        {currentUser?.role !== "supervisor" && roleCounts.gerente > 0 && `${roleCounts.gerente} gerentes • `}
                        {["gerente", "director", "owner"].includes(currentUser?.role) && roleCounts.supervisor > 0 && `${roleCounts.supervisor} supervisores • `}
                        {roleCounts.vendedor} vendedores
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-sm text-gray-600">Total Leads</p>
                      <p className="text-2xl font-bold">{totalLeadsEquipo}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-sm text-gray-600">Vendidos</p>
                      <p className="text-2xl font-bold text-green-600">{vendidosEquipo}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-sm text-gray-600">Perdidos</p>
                      <p className="text-2xl font-bold text-red-600">{leads.filter((l) => l.vendedor && accessibleIds.includes(l.vendedor) && l.estado === "perdido").length}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-sm text-gray-600">Conversión</p>
                      <p className="text-2xl font-bold text-blue-600">{conversionEquipo}%</p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Vista por Estados por Gerente - Desplegable como Dashboard */}
            {["director", "owner"].includes(currentUser?.role || "") && (
              <>
                {users
                  .filter((u: any) => {
                    if (currentUser?.role === "director") return u.role === "gerente" && u.reportsTo === currentUser.id;
                    if (currentUser?.role === "owner") return u.role === "gerente";
                    return false;
                  })
                  .map((gerente: any) => {
                    const supervisoresDelGerente = users.filter((u: any) => u.role === "supervisor" && u.reportsTo === gerente.id);
                    const vendedoresDelGerente = users.filter((u: any) => u.role === "vendedor" && 
                      supervisoresDelGerente.some(sup => sup.id === u.reportsTo));
                    const leadsDelGerente = leads.filter((l) => vendedoresDelGerente.some((v: any) => v.id === l.vendedor));
                    
                    return (
                      <div key={gerente.id} className="bg-white rounded-xl shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-gray-800">
                            Leads por Estado - Equipo de {gerente.name}
                          </h3>
                          <div className="text-sm text-gray-600">
                            {supervisoresDelGerente.length} supervisores • {vendedoresDelGerente.length} vendedores
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                          {Object.entries(estados).map(([key, estado]) => {
                            const count = leadsDelGerente.filter((l) => l.estado === key).length;
                            return (
                              <button
                                key={key}
                                onClick={() => setSelectedEstado(selectedEstado === `${gerente.id}-${key}` ? null : `${gerente.id}-${key}`)}
                                className={`text-center transition-all duration-200 transform hover:scale-105 ${
                                  selectedEstado === `${gerente.id}-${key}` ? "ring-4 ring-blue-300 ring-opacity-50" : ""
                                }`}
                                title={`Ver leads del equipo de ${gerente.name} en estado: ${estado.label}`}
                              >
                                <div className={`${estado.color} text-white rounded-lg p-4 mb-2 hover:opacity-90`}>
                                  <div className="text-2xl font-bold">{count}</div>
                                </div>
                                <div className="text-sm text-gray-600">{estado.label}</div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Lista filtrada de leads por estado y gerente */}
                        {selectedEstado && selectedEstado.startsWith(`${gerente.id}-`) && (
                          <div className="mt-6 border-t pt-6">
                            {(() => {
                              const estadoKey = selectedEstado.split('-')[1];
                              const leadsFiltrados = leadsDelGerente.filter(l => l.estado === estadoKey);
                              
                              return (
                                <div>
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-semibold text-gray-800">
                                      Leads del equipo de {gerente.name} en estado: 
                                      <span className={`ml-2 px-3 py-1 rounded-full text-white text-sm ${estados[estadoKey].color}`}>
                                        {estados[estadoKey].label}
                                      </span>
                                    </h4>
                                    <button 
                                      onClick={() => setSelectedEstado(null)}
                                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                                    >
                                      <X size={16} />
                                      <span>Cerrar filtro</span>
                                    </button>
                                  </div>
                                  
                                  {leadsFiltrados.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">
                                      No hay leads del equipo de {gerente.name} en estado "{estados[estadoKey].label}"
                                    </p>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Supervisor</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {leadsFiltrados.map((lead) => {
                                            const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                                            const supervisor = vendedor ? userById.get(vendedor.reportsTo) : null;
                                            return (
                                              <tr key={lead.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-2">
                                                  <div className="font-medium text-gray-900">{lead.nombre}</div>
                                                </td>
                                                <td className="px-4 py-2">
                                                  <div className="flex items-center space-x-1">
                                                    <Phone size={12} className="text-gray-400" />
                                                    <span className="text-gray-700">{lead.telefono}</span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                  <div>
                                                    <div className="font-medium text-gray-900">{lead.modelo}</div>
                                                    <div className="text-xs text-gray-500">{lead.formaPago}</div>
                                                    {lead.infoUsado && <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>}
                                                  </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                  <div className="flex items-center space-x-1">
                                                    <span className="text-sm">{fuentes[lead.fuente as string]?.icon || "❓"}</span>
                                                    <span className="text-xs text-gray-600">
                                                      {fuentes[lead.fuente as string]?.label || String(lead.fuente)}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-2 text-gray-700">
                                                  {vendedor?.name || "Sin asignar"}
                                                </td>
                                                <td className="px-4 py-2 text-gray-600 text-xs">
                                                  {supervisor?.name || "—"}
                                                </td>
                                                <td className="px-4 py-2 text-gray-500 text-xs">
                                                  {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                  <div className="flex items-center justify-center space-x-1">
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingLeadObservaciones(lead);
                                                        setShowObservacionesModal(true);
                                                      }}
                                                      className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                                      title="Ver/Editar observaciones"
                                                    >
                                                      {lead.notas && lead.notas.length > 0 ? "Ver" : "Obs"}
                                                    </button>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveSection("leads");
                                                      }}
                                                      className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                      title="Ver en tabla completa"
                                                    >
                                                      Ver
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </>
            )}

            {/* Vista general para gerentes y supervisores */}
            {["gerente", "supervisor"].includes(currentUser?.role || "") && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">Leads por Estado en mi Organización</h3>
                  {selectedEstado && (
                    <button 
                      onClick={() => setSelectedEstado(null)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <X size={16} />
                      <span>Cerrar filtro</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(estados).map(([key, estado]) => {
                    const accessibleIds = getAccessibleUserIds(currentUser);
                    const count = leads.filter((l) => l.vendedor && accessibleIds.includes(l.vendedor) && l.estado === key).length;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                        className={`text-center transition-all duration-200 transform hover:scale-105 ${
                          selectedEstado === key ? "ring-4 ring-blue-300 ring-opacity-50" : ""
                        }`}
                        title={`Ver todos los leads en estado: ${estado.label}`}
                      >
                        <div className={`${estado.color} text-white rounded-lg p-4 mb-2 hover:opacity-90`}>
                          <div className="text-2xl font-bold">{count}</div>
                        </div>
                        <div className="text-sm text-gray-600">{estado.label}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Lista filtrada para gerentes y supervisores */}
                {selectedEstado && !selectedEstado.includes('-') && (
                  <div className="mt-6 border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">
                      Leads en estado: <span className={`px-3 py-1 rounded-full text-white text-sm ${estados[selectedEstado].color}`}>
                        {estados[selectedEstado].label}
                      </span>
                    </h4>
                    
                    {(() => {
                      const accessibleIds = getAccessibleUserIds(currentUser);
                      const leadsFiltrados = leads.filter((l) => l.vendedor && accessibleIds.includes(l.vendedor) && l.estado === selectedEstado);
                      
                      if (leadsFiltrados.length === 0) {
                        return (
                          <p className="text-gray-500 text-center py-8">
                            No hay leads en estado "{estados[selectedEstado].label}"
                          </p>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {leadsFiltrados.map((lead) => {
                                const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                                return (
                                  <tr key={lead.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2">
                                      <div className="font-medium text-gray-900">{lead.nombre}</div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center space-x-1">
                                        <Phone size={12} className="text-gray-400" />
                                        <span className="text-gray-700">{lead.telefono}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div>
                                        <div className="font-medium text-gray-900">{lead.modelo}</div>
                                        <div className="text-xs text-gray-500">{lead.formaPago}</div>
                                        {lead.infoUsado && <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center space-x-1">
                                        <span className="text-sm">{fuentes[lead.fuente as string]?.icon || "❓"}</span>
                                        <span className="text-xs text-gray-600">
                                          {fuentes[lead.fuente as string]?.label || String(lead.fuente)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-gray-700">
                                      {vendedor?.name || "Sin asignar"}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 text-xs">
                                      {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <div className="flex items-center justify-center space-x-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLeadObservaciones(lead);
                                            setShowObservacionesModal(true);
                                          }}
                                          className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                          title="Ver/Editar observaciones"
                                        >
                                          {lead.notas && lead.notas.length > 0 ? "Ver" : "Obs"}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveSection("leads");
                                          }}
                                          className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                                          title="Ver en tabla completa"
                                        >
                                          Ver
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Vista jerárquica por roles */}
            {currentUser?.role !== "supervisor" && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Estructura Organizacional</h3>
                
                {/* Para Gerentes: mostrar sus supervisores y vendedores */}
                {currentUser?.role === "gerente" && (
                  <div className="space-y-6">
                    {users
                      .filter((u: any) => u.role === "supervisor" && u.reportsTo === currentUser.id)
                      .map((supervisor: any) => {
                        const vendedoresDeSupervisor = users.filter((u: any) => u.role === "vendedor" && u.reportsTo === supervisor.id);
                        const leadsSupervisor = leads.filter((l) => vendedoresDeSupervisor.some((v: any) => v.id === l.vendedor));
                        const ventasSupervisor = leadsSupervisor.filter((l) => l.estado === "vendido").length;
                        const conversionSup = leadsSupervisor.length > 0 ? ((ventasSupervisor / leadsSupervisor.length) * 100).toFixed(1) : "0";
                        
                        return (
                          <div key={supervisor.id} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                  <UserCheck size={20} className="text-purple-600" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-800">{supervisor.name}</h4>
                                  <p className="text-sm text-gray-600">Supervisor</p>
                                  <p className="text-xs text-gray-500">{vendedoresDeSupervisor.length} vendedores a cargo</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-gray-800">{ventasSupervisor} ventas</div>
                                <div className="text-sm text-gray-600">{leadsSupervisor.length} leads</div>
                                <div className="text-sm font-medium text-blue-600">{conversionSup}%</div>
                              </div>
                            </div>
                            
                            {/* Vendedores de este supervisor */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {vendedoresDeSupervisor.map((vendedor: any) => {
                                const leadsVendedor = leads.filter((l) => l.vendedor === vendedor.id);
                                const ventasVendedor = leadsVendedor.filter((l) => l.estado === "vendido").length;
                                const conversionVend = leadsVendedor.length > 0 ? ((ventasVendedor / leadsVendedor.length) * 100).toFixed(1) : "0";
                                
                                return (
                                  <div key={vendedor.id} className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        </div>
                                        <div>
                                          <span className="text-sm font-medium text-gray-700">{vendedor.name}</span>
                                          <div className="flex items-center space-x-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                              vendedor.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                            }`}>
                                              {vendedor.active ? "Activo" : "Inactivo"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right text-sm">
                                        <div className="font-medium text-gray-800">{ventasVendedor}/{leadsVendedor.length}</div>
                                        <div className="text-xs text-gray-500">{conversionVend}%</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {vendedoresDeSupervisor.length === 0 && (
                                <p className="text-sm text-gray-400 col-span-2 text-center py-4">Sin vendedores asignados</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Para Directores: mostrar gerentes, supervisores y vendedores */}
                {currentUser?.role === "director" && (
                  <div className="space-y-6">
                    {users
                      .filter((u: any) => u.role === "gerente" && u.reportsTo === currentUser.id)
                      .map((gerente: any) => {
                        const supervisoresDelGerente = users.filter((u: any) => u.role === "supervisor" && u.reportsTo === gerente.id);
                        const vendedoresDelGerente = users.filter((u: any) => u.role === "vendedor" && 
                          supervisoresDelGerente.some(sup => sup.id === u.reportsTo));
                        const leadsGerente = leads.filter((l) => vendedoresDelGerente.some((v: any) => v.id === l.vendedor));
                        const ventasGerente = leadsGerente.filter((l) => l.estado === "vendido").length;
                        const conversionGer = leadsGerente.length > 0 ? ((ventasGerente / leadsGerente.length) * 100).toFixed(1) : "0";
                        
                        return (
                          <div key={gerente.id} className="border-2 border-blue-200 rounded-lg p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                  <Users size={24} className="text-blue-600" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-lg text-gray-800">{gerente.name}</h4>
                                  <p className="text-sm text-gray-600">Gerente</p>
                                  <p className="text-xs text-gray-500">
                                    {supervisoresDelGerente.length} supervisores • {vendedoresDelGerente.length} vendedores
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-gray-800">{ventasGerente} ventas</div>
                                <div className="text-sm text-gray-600">{leadsGerente.length} leads</div>
                                <div className="text-sm font-medium text-blue-600">{conversionGer}%</div>
                              </div>
                            </div>
                            
                            {/* Supervisores del gerente */}
                            <div className="space-y-4">
                              {supervisoresDelGerente.map((supervisor: any) => {
                                const vendedoresDeSupervisor = users.filter((u: any) => u.role === "vendedor" && u.reportsTo === supervisor.id);
                                const leadsSupervisor = leads.filter((l) => vendedoresDeSupervisor.some((v: any) => v.id === l.vendedor));
                                const ventasSupervisor = leadsSupervisor.filter((l) => l.estado === "vendido").length;
                                
                                return (
                                  <div key={supervisor.id} className="ml-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                          <UserCheck size={16} className="text-purple-600" />
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">{supervisor.name}</span>
                                          <p className="text-xs text-gray-500">Supervisor - {vendedoresDeSupervisor.length} vendedores</p>
                                        </div>
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {ventasSupervisor}/{leadsSupervisor.length}
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 ml-4">
                                      {vendedoresDeSupervisor.map((vendedor: any) => {
                                        const leadsVendedor = leads.filter((l) => l.vendedor === vendedor.id);
                                        const ventasVendedor = leadsVendedor.filter((l) => l.estado === "vendido").length;
                                        
                                        return (
                                          <div key={vendedor.id} className="flex items-center justify-between text-xs bg-white rounded p-2">
                                            <span className="text-gray-700">{vendedor.name}</span>
                                            <span className="font-medium">{ventasVendedor}/{leadsVendedor.length}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Para Owner: mostrar toda la jerarquía */}
                {currentUser?.role === "owner" && (
                  <div className="space-y-6">
                    {users
                      .filter((u: any) => u.role === "director")
                      .map((director: any) => {
                        const gerentesDelDirector = users.filter((u: any) => u.role === "gerente" && u.reportsTo === director.id);
                        const supervisoresDelDirector = users.filter((u: any) => u.role === "supervisor" && 
                          gerentesDelDirector.some(ger => ger.id === u.reportsTo));
                        const vendedoresDelDirector = users.filter((u: any) => u.role === "vendedor" && 
                          supervisoresDelDirector.some(sup => sup.id === u.reportsTo));
                        const leadsDirector = leads.filter((l) => vendedoresDelDirector.some((v: any) => v.id === l.vendedor));
                        const ventasDirector = leadsDirector.filter((l) => l.estado === "vendido").length;
                        const conversionDir = leadsDirector.length > 0 ? ((ventasDirector / leadsDirector.length) * 100).toFixed(1) : "0";
                        
                        return (
                          <div key={director.id} className="border-4 border-green-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center space-x-4">
                                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                                  <Trophy size={28} className="text-green-600" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-xl text-gray-800">{director.name}</h4>
                                  <p className="text-sm text-gray-600">Director</p>
                                  <p className="text-xs text-gray-500">
                                    {gerentesDelDirector.length} gerentes • {supervisoresDelDirector.length} supervisores • {vendedoresDelDirector.length} vendedores
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-gray-800">{ventasDirector} ventas</div>
                                <div className="text-sm text-gray-600">{leadsDirector.length} leads</div>
                                <div className="text-sm font-medium text-green-600">{conversionDir}%</div>
                              </div>
                            </div>
                            
                            {/* Gerentes del director */}
                            <div className="space-y-4">
                              {gerentesDelDirector.map((gerente: any) => {
                                const supervisoresDelGerente = users.filter((u: any) => u.role === "supervisor" && u.reportsTo === gerente.id);
                                const vendedoresDelGerente = users.filter((u: any) => u.role === "vendedor" && 
                                  supervisoresDelGerente.some(sup => sup.id === u.reportsTo));
                                const leadsGerente = leads.filter((l) => vendedoresDelGerente.some((v: any) => v.id === l.vendedor));
                                const ventasGerente = leadsGerente.filter((l) => l.estado === "vendido").length;
                                
                                return (
                                  <div key={gerente.id} className="ml-6 border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                          <Users size={20} className="text-blue-600" />
                                        </div>
                                        <div>
                                          <span className="font-semibold text-gray-800">{gerente.name}</span>
                                          <p className="text-xs text-gray-600">Gerente - {supervisoresDelGerente.length} supervisores, {vendedoresDelGerente.length} vendedores</p>
                                        </div>
                                      </div>
                                      <div className="text-sm text-gray-700 font-medium">
                                        {ventasGerente}/{leadsGerente.length}
                                      </div>
                                    </div>
                                    
                                    {/* Supervisores del gerente */}
                                    <div className="space-y-2 ml-4">
                                      {supervisoresDelGerente.map((supervisor: any) => {
                                        const vendedoresDeSupervisor = users.filter((u: any) => u.role === "vendedor" && u.reportsTo === supervisor.id);
                                        const leadsSupervisor = leads.filter((l) => vendedoresDeSupervisor.some((v: any) => v.id === l.vendedor));
                                        const ventasSupervisor = leadsSupervisor.filter((l) => l.estado === "vendido").length;
                                        
                                        return (
                                          <div key={supervisor.id} className="border border-gray-300 rounded p-3 bg-white">
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center space-x-2">
                                                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                                                  <UserCheck size={12} className="text-purple-600" />
                                                </div>
                                                <span className="text-sm font-medium text-gray-700">{supervisor.name}</span>
                                                <span className="text-xs text-gray-500">({vendedoresDeSupervisor.length} vend.)</span>
                                              </div>
                                              <span className="text-xs font-medium text-gray-600">{ventasSupervisor}/{leadsSupervisor.length}</span>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-1">
                                              {vendedoresDeSupervisor.map((vendedor: any) => {
                                                const leadsVendedor = leads.filter((l) => l.vendedor === vendedor.id);
                                                const ventasVendedor = leadsVendedor.filter((l) => l.estado === "vendido").length;
                                                
                                                return (
                                                  <span key={vendedor.id} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                    {vendedor.name} ({ventasVendedor}/{leadsVendedor.length})
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Vista detallada de vendedores para supervisores */}
            {currentUser?.role === "supervisor" && (
              <>
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nuevos</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Contactados</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Interesados</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Negociación</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vendidos</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Perdidos</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Conversión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users
                        .filter((u: any) => u.role === "vendedor" && u.reportsTo === currentUser?.id)
                        .map((vendedor: any) => {
                          const leadsVendedor = leads.filter((l) => l.vendedor === vendedor.id);
                          const stats = {
                            nuevo: leadsVendedor.filter((l) => l.estado === "nuevo").length,
                            contactado: leadsVendedor.filter((l) => l.estado === "contactado").length,
                            interesado: leadsVendedor.filter((l) => l.estado === "interesado").length,
                            negociacion: leadsVendedor.filter((l) => l.estado === "negociacion").length,
                            vendido: leadsVendedor.filter((l) => l.estado === "vendido").length,
                            perdido: leadsVendedor.filter((l) => l.estado === "perdido").length,
                            total: leadsVendedor.length
                          };
                          const conversion = stats.total > 0 ? ((stats.vendido / stats.total) * 100).toFixed(1) : "0";
                          
                          return (
                            <tr key={vendedor.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{vendedor.name}</div>
                                    <div className="text-xs text-gray-500">{vendedor.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  vendedor.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                }`}>
                                  {vendedor.active ? "Activo" : "Inactivo"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-blue-600 font-medium">{stats.nuevo}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-yellow-600 font-medium">{stats.contactado}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-orange-600 font-medium">{stats.interesado}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-purple-600 font-medium">{stats.negociacion}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-green-600 font-bold">{stats.vendido}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-red-600 font-medium">{stats.perdido}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="font-bold">{stats.total}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center">
                                  <span className={`text-sm font-bold ${
                                    parseFloat(conversion) > 20 ? "text-green-600" : 
                                    parseFloat(conversion) > 10 ? "text-yellow-600" : "text-red-600"
                                  }`}>
                                    {conversion}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Rendimiento del Equipo</h3>
                  <div className="space-y-4">
                    {users
                      .filter((u: any) => u.role === "vendedor" && u.reportsTo === currentUser?.id)
                      .map((vendedor: any) => {
                        const leadsVendedor = leads.filter((l) => l.vendedor === vendedor.id);
                        const vendidos = leadsVendedor.filter((l) => l.estado === "vendido").length;
                        const total = leadsVendedor.length;
                        const porcentaje = total > 0 ? (vendidos / total) * 100 : 0;
                        
                        return (
                          <div key={vendedor.id} className="flex items-center space-x-4">
                            <div className="w-32 text-sm font-medium text-gray-700">{vendedor.name}</div>
                            <div className="flex-1">
                              <div className="w-full bg-gray-200 rounded-full h-6 relative">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-green-500 h-6 rounded-full"
                                  style={{ width: `${porcentaje}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                                  {vendidos}/{total} leads
                                </span>
                              </div>
                            </div>
                            <div className="w-16 text-right font-bold text-gray-700">
                              {porcentaje.toFixed(0)}%
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}

            {/* Top vendedores en el scope */}
            {["gerente", "director", "owner"].includes(currentUser?.role || "") && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Top Vendedores en mi Organización</h3>
                <div className="space-y-3">
                  {(() => {
                    const accessibleIds = getAccessibleUserIds(currentUser);
                    const vendedoresEnScope = users.filter((u: any) => u.role === "vendedor" && accessibleIds.includes(u.id));
                    
                    return vendedoresEnScope
                      .map((vendedor: any) => {
                        const leadsVendedor = leads.filter((l) => l.vendedor === vendedor.id);
                        const ventasVendedor = leadsVendedor.filter((l) => l.estado === "vendido").length;
                        const supervisorNombre = userById.get(vendedor.reportsTo)?.name || "Sin supervisor";
                        
                        return {
                          ...vendedor,
                          ventas: ventasVendedor,
                          totalLeads: leadsVendedor.length,
                          supervisor: supervisorNombre,
                          conversion: leadsVendedor.length > 0 ? ((ventasVendedor / leadsVendedor.length) * 100).toFixed(1) : "0"
                        };
                      })
                      .sort((a, b) => b.ventas - a.ventas)
                      .slice(0, 10)
                      .map((vendedor, index) => (
                        <div key={vendedor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-orange-600" : "bg-gray-300"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">{vendedor.name}</div>
                              <div className="text-xs text-gray-600">Supervisor: {vendedor.supervisor}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-800">{vendedor.ventas} ventas</div>
                            <div className="text-xs text-gray-600">{vendedor.totalLeads} leads - {vendedor.conversion}%</div>
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Alertas */}
        {activeSection === "alerts" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Alertas</h2>
              {currentUser && (
                <button
                  onClick={() => setAlerts((prev) => prev.map((a) => (a.userId === currentUser.id ? { ...a, read: true } : a)))}
                  className="px-3 py-2 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-lg">
              <ul className="divide-y divide-gray-100">
                {currentUser &&
                  alerts
                    .filter((a) => a.userId === currentUser.id)
                    .reverse()
                    .map((a) => (
                      <li key={a.id} className="p-4 flex items-start justify-between">
                        <div>
                          <p className="text-sm text-gray-800">{a.type === "lead_assigned" ? "🧲 " : "🏆 "}{a.message}</p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(a.ts).toLocaleString("es-AR")}</p>
                        </div>
                        {!a.read && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Nueva</span>}
                      </li>
                    ))}
                {(!currentUser || alerts.filter((a) => a.userId === currentUser.id).length === 0) && (
                  <li className="p-6 text-sm text-gray-500">No hay alertas.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Leads */}
        {activeSection === "leads" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-gray-800">Gestión de Leads</h2>
              <button onClick={() => setShowNewLeadModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700">
                <Plus size={20} />
                <span>Nuevo Lead</span>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Historial</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observaciones</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getFilteredLeads().map((lead) => {
                    const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                    return (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{lead.nombre}</div>
                            <div className="text-xs text-gray-500">{lead.fecha ? String(lead.fecha).slice(0, 10) : ""}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <Phone size={16} className="text-gray-400" />
                            <span className="text-sm">{lead.telefono}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium">{lead.modelo}</div>
                            <div className="text-xs text-gray-500">{lead.formaPago}</div>
                            {lead.infoUsado && <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>}
                            {lead.entrega && <div className="text-xs text-green-600">✓ Entrega usado</div>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{fuentes[lead.fuente as string]?.icon || "❓"}</span>
                            <div>
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${fuentes[lead.fuente as string]?.color || "bg-gray-400"}`}>
                                {fuentes[lead.fuente as string]?.label || String(lead.fuente)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={lead.estado}
                            onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                            className={`px-3 py-1 rounded-full text-xs font-medium text-white ${estados[lead.estado].color}`}
                          >
                            {Object.entries(estados).map(([key]) => (
                              <option key={key} value={key} className="text-black">
                                {estados[key as keyof typeof estados].label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {currentUser && ["owner", "director", "gerente", "supervisor"].includes(currentUser.role) ? (
                            <select
                              value={lead.vendedor ?? ""}
                              onChange={async (e) => {
                                const newVend = parseInt(e.target.value, 10);
                                try {
                                  const updated = await apiUpdateLead(lead.id, { vendedor: newVend });
                                  const mapped = mapLeadFromApi(updated);
                                  setLeads((prev) => prev.map((l) => (l.id === lead.id ? mapped : l)));
                                  if (mapped.vendedor) pushAlert(mapped.vendedor, "lead_assigned", `Te reasignaron el lead: ${mapped.nombre}`);
                                } catch (err) {
                                  console.error("No pude reasignar lead", err);
                                }
                              }}
                              className="px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="" disabled>
                                Seleccionar...
                              </option>
                              {users
                                .filter((u: any) => u.role === "vendedor" && visibleUserIds.includes(u.id))
                                .map((u: any) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} {u.active ? "" : "(inactivo)"}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            vendedor?.name || "—"
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            {lead.historial && lead.historial.length > 0 ? (
                              <button
                                onClick={() => {
                                  setViewingLeadHistorial(lead);
                                  setShowHistorialModal(true);
                                }}
                                className="w-full text-left hover:bg-gray-50 p-2 rounded border"
                                title="Click para ver historial completo"
                              >
                                <div className="space-y-1">
                                  {lead.historial.slice(-3).map((entry, index) => {
                                    const fecha = new Date(entry.timestamp).toLocaleString("es-AR", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    });
                                    return (
                                      <div key={index} className="text-xs flex items-center space-x-1">
                                        <span className={`px-1 py-0.5 rounded text-white text-[10px] ${estados[entry.estado]?.color || 'bg-gray-400'}`}>
                                          {estados[entry.estado]?.label || entry.estado}
                                        </span>
                                        <span className="text-gray-500">{fecha}</span>
                                        <span className="text-gray-400">por {entry.usuario}</span>
                                      </div>
                                    );
                                  })}
                                  {lead.historial.length > 3 && (
                                    <div className="text-xs text-blue-600 font-medium">
                                      +{lead.historial.length - 3} más... (Click para ver todo)
                                    </div>
                                  )}
                                </div>
                              </button>
                            ) :import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Users, Trophy, Plus, Phone, BarChart3, Settings, Home, X, Trash2, Edit3, Bell, UserCheck } from "lucide-react";
import { api } from "./api";
import {
  listUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
} from "./services/users";
import {
  listLeads,
  createLead as apiCreateLead,
  updateLead as apiUpdateLead,
  deleteLead as apiDeleteLead,
} from "./services/leads";

// ===== Utilidades de jerarquía =====
function buildIndex(users: any[]) {
  const byId = new Map(users.map((u: any) => [u.id, u]));
  const children = new Map<number, number[]>();
  users.forEach((u: any) => children.set(u.id, []));
  users.forEach((u: any) => {
    if (u.reportsTo) (children.get(u.reportsTo) as number[] | undefined)?.push(u.id);
  });
  return { byId, children };
}

function getDescendantUserIds(rootId: number, childrenIndex: Map<number, number[]>) {
  const out: number[] = [];
  const stack = [...(childrenIndex.get(rootId) || [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    const kids = childrenIndex.get(id) || [];
    for (const k of kids) stack.push(k);
  }
  return out;
}

const roles: Record<string, string> = {
  owner: "Dueño",
  director: "Director",
  gerente: "Gerente",
  supervisor: "Supervisor",
  vendedor: "Vendedor",
};

const estados: Record<string, { label: string; color: string }> = {
  nuevo: { label: "Nuevo", color: "bg-blue-500" },
  contactado: { label: "Contactado", color: "bg-yellow-500" },
  interesado: { label: "Interesado", color: "bg-orange-500" },
  negociacion: { label: "Negociación", color: "bg-purple-500" },
  vendido: { label: "Vendido", color: "bg-green-600" },
  perdido: { label: "Perdido", color: "bg-red-500" },
  numero_invalido: { label: "Número inválido", color: "bg-gray-500" },
  no_contesta_1: { label: "No contesta 1", color: "bg-amber-500" },
  no_contesta_2: { label: "No contesta 2", color: "bg-orange-600" },
  no_contesta_3: { label: "No contesta 3", color: "bg-red-600" },
};

const fuentes: Record<string, { label: string; color: string; icon: string }> = {
  meta: { label: "Meta/Facebook", color: "bg-blue-600", icon: "📱" },
  whatsapp: { label: "WhatsApp Bot", color: "bg-green-500", icon: "💬" },
  whatsapp_100: { label: "WhatsApp Bot 100", color: "bg-green-700", icon: "💬" },
  sitio_web: { label: "Sitio Web", color: "bg-purple-600", icon: "🌐" },
  referido: { label: "Referido", color: "bg-orange-500", icon: "👥" },
  telefono: { label: "Llamada", color: "bg-indigo-500", icon: "📞" },
  showroom: { label: "Showroom", color: "bg-gray-600", icon: "🏢" },
  google: { label: "Google Ads", color: "bg-red-500", icon: "🎯" },
  instagram: { label: "Instagram", color: "bg-pink-500", icon: "📸" },
  otro: { label: "Otro", color: "bg-gray-400", icon: "❓" },
};

type LeadRow = {
  id: number;
  nombre: string;
  telefono: string;
  modelo: string;
  formaPago?: string;
  infoUsado?: string;
  entrega?: boolean;
  fecha?: string;
  estado: keyof typeof estados;
  vendedor: number | null;
  notas?: string;
  fuente: keyof typeof fuentes | string;
  historial?: Array<{
    estado: string;
    timestamp: string;
    usuario: string;
  }>;
};

type Alert = {
  id: number;
  userId: number;
  type: "lead_assigned" | "ranking_change";
  message: string;
  ts: string;
  read: boolean;
};

export default function CRM() {
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const { byId: userById, children: childrenIndex } = useMemo(() => buildIndex(users), [users]);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState<"dashboard" | "leads" | "calendar" | "ranking" | "users" | "alerts" | "team">("dashboard");
  const [loginError, setLoginError] = useState("");
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'roberto' | 'daniel'>('roberto');

  // ===== Login contra backend =====
  const handleLogin = async (email: string, password: string) => {
    try {
      const r = await api.post("/auth/login", { email, password });
      
      // Verificar respuesta exitosa
      if (r.data?.ok && r.data?.token) {
        // Guardar token
        localStorage.setItem('token', r.data.token);
        localStorage.setItem('user', JSON.stringify(r.data.user));
        
        // Configurar axios para futuras peticiones
        api.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`;
        
        const u = r.data.user || {
          id: 0,
          name: r.data?.user?.email || email,
          email,
          role: r.data?.user?.role || "owner",
          reportsTo: null,
          active: true,
        };
        
        setCurrentUser(u);
        setIsAuthenticated(true);
        setLoginError("");

        // Cargar datos
        const [uu, ll] = await Promise.all([listUsers(), listLeads()]);
        const mappedLeads: LeadRow[] = (ll || []).map((L: any) => ({
          id: L.id,
          nombre: L.nombre,
          telefono: L.telefono,
          modelo: L.modelo,
          formaPago: L.formaPago,
          infoUsado: L.infoUsado,
          entrega: L.entrega,
          fecha: L.fecha || L.created_at || "",
          estado: (L.estado || "nuevo") as LeadRow["estado"],
          vendedor: L.assigned_to ?? null,
          notas: L.notas || "",
          fuente: (L.fuente || "otro") as LeadRow["fuente"],
          historial: L.historial || [],
        }));
        setUsers(uu || []);
        setLeads(mappedLeads);
      } else {
        throw new Error("Respuesta inválida del servidor");
      }
    } catch (err: any) {
      setLoginError(err?.response?.data?.error || "Credenciales incorrectas");
      setIsAuthenticated(false);
    }
  };

  // ===== Acceso por rol =====
  const getAccessibleUserIds = (user: any) => {
    if (!user) return [] as number[];
    if (["owner", "director"].includes(user.role)) return users.map((u: any) => u.id);
    const ids = [user.id, ...getDescendantUserIds(user.id, childrenIndex)];
    return ids;
  };
  const canManageUsers = () => currentUser && ["owner", "director", "gerente"].includes(currentUser.role);
  const isOwner = () => currentUser?.role === "owner";

  // ===== Round-robin =====
  const [rrIndex, setRrIndex] = useState(0);
  const getActiveVendorIdsInScope = (scopeUser?: any) => {
    if (!scopeUser) return [] as number[];
    const scope = getAccessibleUserIds(scopeUser);
    return users.filter((u: any) => u.role === "vendedor" && u.active && scope.includes(u.id)).map((u: any) => u.id);
  };
  const pickNextVendorId = (scopeUser?: any) => {
    const pool = getActiveVendorIdsInScope(scopeUser || currentUser);
    if (pool.length === 0) return null;
    const id = pool[rrIndex % pool.length];
    setRrIndex((i) => i + 1);
    return id;
  };

  // ===== Alertas (locales de UI) =====
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const nextAlertId = useRef(1);
  const pushAlert = (userId: number, type: Alert["type"], message: string) => {
    setAlerts((prev) => [...prev, { id: nextAlertId.current++, userId, type, message, ts: new Date().toISOString(), read: false }]);
  };
  const pushAlertToChain = (vendorId: number, type: Alert["type"], message: string) => {
    pushAlert(vendorId, type, message);
    const sup = users.find((u: any) => u.id === userById.get(vendorId)?.reportsTo);
    if (sup) pushAlert(sup.id, type, message);
    const gerente = sup ? users.find((u: any) => u.id === sup.reportsTo) : null;
    if (gerente) pushAlert(gerente.id, type, message);
  };
  const unreadCount = (uid: number) => alerts.filter((a) => a.userId === uid && !a.read).length;

  // ===== Filtrados y ranking =====
  const visibleUserIds = useMemo(() => getAccessibleUserIds(currentUser), [currentUser, users]);

  const getFilteredLeads = () => {
    if (!currentUser) return [] as LeadRow[];
    return leads.filter((l) => (l.vendedor ? visibleUserIds.includes(l.vendedor) : true));
  };

  const getRanking = () => {
    const vendedores = users.filter((u: any) => u.role === "vendedor");
    return vendedores
      .map((v: any) => {
        const ventas = leads.filter((l) => l.vendedor === v.id && l.estado === "vendido").length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return { id: v.id, nombre: v.name, ventas, leadsAsignados, team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}` };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  const getRankingInScope = () => {
    const vendedores = users.filter((u: any) => u.role === "vendedor" && visibleUserIds.includes(u.id));
    return vendedores
      .map((v: any) => {
        const ventas = leads.filter((l) => l.vendedor === v.id && l.estado === "vendido").length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return { id: v.id, nombre: v.name, ventas, leadsAsignados, team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}` };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  const prevRankingRef = useRef(new Map<number, number>());
  useEffect(() => {
    const r = getRanking();
    const curr = new Map<number, number>();
    r.forEach((row, idx) => curr.set(row.id, idx + 1));
    const prev = prevRankingRef.current;
    curr.forEach((pos, vid) => {
      const before = prev.get(vid);
      if (before && before !== pos) {
        const delta = before - pos;
        const msg = delta > 0 ? `¡Subiste ${Math.abs(delta)} puesto(s) en el ranking!` : `Bajaste ${Math.abs(delta)} puesto(s) en el ranking.`;
        pushAlertToChain(vid, "ranking_change", msg);
      }
    });
    prevRankingRef.current = curr;
  }, [leads, users, userById]);

  const getDashboardStats = () => {
    const filteredLeads = getFilteredLeads();
    const vendidos = filteredLeads.filter((lead) => lead.estado === "vendido").length;
    const conversion = filteredLeads.length > 0 ? ((vendidos / filteredLeads.length) * 100).toFixed(1) : 0;
    return { totalLeads: filteredLeads.length, vendidos, conversion };
  };

  const getSourceMetrics = () => {
    const filteredLeads = getFilteredLeads();
    const sourceData = Object.keys(fuentes)
      .map((source) => {
        const sourceLeads = filteredLeads.filter((lead) => lead.fuente === source);
        const vendidos = sourceLeads.filter((lead) => lead.estado === "vendido").length;
        const conversion = sourceLeads.length > 0 ? ((vendidos / sourceLeads.length) * 100).toFixed(1) : "0";
        return {
          source,
          total: sourceLeads.length,
          vendidos,
          conversion: parseFloat(conversion),
          ...fuentes[source],
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    return sourceData;
  };

  // ===== Acciones de Leads (API) =====
  const mapLeadFromApi = (L: any): LeadRow => ({
    id: L.id,
    nombre: L.nombre,
    telefono: L.telefono,
    modelo: L.modelo,
    formaPago: L.formaPago,
    infoUsado: L.infoUsado,
    entrega: L.entrega,
    fecha: L.fecha || L.created_at || "",
    estado: (L.estado || "nuevo") as LeadRow["estado"],
    vendedor: L.assigned_to ?? null,
    notas: L.notas || "",
    fuente: (L.fuente || "otro") as LeadRow["fuente"],
    historial: L.historial || [],
  });

  const addHistorialEntry = (leadId: number, estado: string) => {
    if (!currentUser) return;
    setLeads(prev => prev.map(lead => 
      lead.id === leadId 
        ? {
            ...lead,
            historial: [
              ...(lead.historial || []),
              {
                estado,
                timestamp: new Date().toISOString(),
                usuario: currentUser.name
              }
            ]
          }
        : lead
    ));
  };

  const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { estado: newStatus });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l)));
      
      // Agregar entrada al historial
      addHistorialEntry(leadId, newStatus);
    } catch (e) {
      console.error("No pude actualizar estado del lead", e);
    }
  };

  // ===== Crear Lead y Modales =====
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showObservacionesModal, setShowObservacionesModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [editingLeadObservaciones, setEditingLeadObservaciones] = useState<LeadRow | null>(null);
  const [viewingLeadHistorial, setViewingLeadHistorial] = useState<LeadRow | null>(null);

  const handleUpdateObservaciones = async (leadId: number, observaciones: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { notas: observaciones });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l)));
      setShowObservacionesModal(false);
      setEditingLeadObservaciones(null);
    } catch (e) {
      console.error("No pude actualizar observaciones del lead", e);
    }
  };

  const handleCreateLead = async () => {
    const nombre = (document.getElementById("new-nombre") as HTMLInputElement).value.trim();
    const telefono = (document.getElementById("new-telefono") as HTMLInputElement).value.trim();
    const modelo = (document.getElementById("new-modelo") as HTMLInputElement).value.trim();
    const formaPago = (document.getElementById("new-formaPago") as HTMLSelectElement).value;
    const infoUsado = (document.getElementById("new-infoUsado") as HTMLInputElement).value.trim();
    const entrega = (document.getElementById("new-entrega") as HTMLInputElement).checked;
    const fecha = (document.getElementById("new-fecha") as HTMLInputElement).value;
    const fuente = (document.getElementById("new-fuente") as HTMLSelectElement).value;
    const autoAssign = (document.getElementById("new-autoassign") as HTMLInputElement)?.checked;
    const vendedorSelVal = (document.getElementById("new-vendedor") as HTMLSelectElement).value;

    const vendedorIdSelRaw = parseInt(vendedorSelVal, 10);
    const vendedorIdSel = Number.isNaN(vendedorIdSelRaw) ? null : vendedorIdSelRaw;
    const vendedorId = autoAssign ? pickNextVendorId(currentUser) ?? vendedorIdSel ?? null : vendedorIdSel ?? null;

    if (nombre && telefono && modelo && fuente) {
      try {
        const created = await apiCreateLead({
          nombre,
          telefono,
          modelo,
          formaPago,
          notas: "",
          estado: "nuevo",
          fuente,
          infoUsado,
          entrega,
          fecha,
          vendedor: vendedorId, // backend: assigned_to
        } as any);
        const mapped = mapLeadFromApi(created);
        if (mapped.vendedor) pushAlert(mapped.vendedor, "lead_assigned", `Nuevo lead asignado: ${mapped.nombre}`);
        setLeads((prev) => [mapped, ...prev]);
        setShowNewLeadModal(false);
        
        // Agregar entrada inicial al historial
        addHistorialEntry(mapped.id, "nuevo");
      } catch (e) {
        console.error("No pude crear el lead", e);
      }
    }
  };

  // ===== Calendario (UI local) =====
  const [events, setEvents] = useState<any[]>([]);
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState<number | null>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const visibleUsers = useMemo(
    () => (currentUser ? users.filter((u: any) => getAccessibleUserIds(currentUser).includes(u.id)) : []),
    [currentUser, users]
  );
  const eventsForSelectedUser = useMemo(() => {
    const uid = selectedCalendarUserId || currentUser?.id;
    return events
      .filter((e) => e.userId === uid)
      .sort((a, b) => ((a.date + (a.time || "")) > (b.date + (b.time || "")) ? 1 : -1));
  }, [events, selectedCalendarUserId, currentUser]);
  const formatterEs = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "2-digit", month: "long" });

  const createEvent = () => {
    const title = (document.getElementById("ev-title") as HTMLInputElement).value;
    const date = (document.getElementById("ev-date") as HTMLInputElement).value;
    const time = (document.getElementById("ev-time") as HTMLInputElement).value;
    const userId = parseInt((document.getElementById("ev-user") as HTMLSelectElement).value, 10);
    if (title && date && userId) {
      setEvents((prev) => [...prev, { id: Math.max(0, ...prev.map((e: any) => e.id)) + 1, title, date, time: time || "09:00", userId }]);
      setShowNewEventModal(false);
    }
  };
  const deleteEvent = (id: number) => setEvents((prev) => prev.filter((e: any) => e.id !== id));

  // ===== Gestión de Usuarios (API) =====
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [modalRole, setModalRole] = useState<"owner" | "director" | "gerente" | "supervisor" | "vendedor">("vendedor");
  const [modalReportsTo, setModalReportsTo] = useState<number | null>(null);

  const validRolesByUser = (user: any) => {
    if (!user) return [];
    switch (user.role) {
      case "owner":
        return ["director", "gerente", "supervisor", "vendedor"];
      case "director":
        return ["gerente", "supervisor", "vendedor"];
      case "gerente":
        return ["supervisor", "vendedor"];
      default:
        return [];
    }
  };
  const validManagersByRole = (role: string) => {
    switch (role) {
      case "owner":
        return [];
      case "director":
        return users.filter((u: any) => u.role === "owner");
      case "gerente":
        return users.filter((u: any) => u.role === "director");
      case "supervisor":
        return users.filter((u: any) => u.role === "gerente");
      case "vendedor":
        return users.filter((u: any) => u.role === "supervisor");
      default:
        return [];
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    const availableRoles = validRolesByUser(currentUser);
    const roleDefault = (availableRoles?.[0] as typeof modalRole) || "vendedor";
    const managers = validManagersByRole(roleDefault);
    setModalRole(roleDefault);
    setModalReportsTo(managers[0]?.id ?? null);
    setShowUserModal(true);
  };

  const openEditUser = (u: any) => {
    setEditingUser(u);
    const roleCurrent = u.role as typeof modalRole;
    const availableRoles: string[] =
      currentUser.role === "owner" && u.id === currentUser.id
        ? ["owner", ...validRolesByUser(currentUser)]
        : validRolesByUser(currentUser);
    const roleToSet = availableRoles.includes(roleCurrent) ? roleCurrent : (availableRoles[0] as any);
    const managers = validManagersByRole(roleToSet);
    setModalRole(roleToSet as any);
    setModalReportsTo(roleToSet === "owner" ? null : u.reportsTo ?? managers[0]?.id ?? null);
    setShowUserModal(true);
  };

  const saveUser = async () => {
    const name = (document.getElementById("u-name") as HTMLInputElement).value.trim();
    const email = (document.getElementById("u-email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("u-pass") as HTMLInputElement).value;
    if (!name || !email) return;
    const finalReportsTo = modalRole === "owner" ? null : modalReportsTo ?? null;

    try {
      if (editingUser) {
        const updated = await apiUpdateUser(editingUser.id, {
          name,
          email,
          password: password || undefined,
          role: modalRole,
          reportsTo: finalReportsTo,
          active: editingUser.active,
        });
        setUsers((prev) => prev.map((u: any) => (u.id === editingUser.id ? updated : u)));
      } else {
        const created = await apiCreateUser({
          name,
          email,
          password: password || "123456",
          role: modalRole,
          reportsTo: finalReportsTo,
          active: 1,
        } as any);
        setUsers((prev) => [...prev, created]);
      }
      setShowUserModal(false);
    } catch (e) {
      console.error("No pude guardar usuario", e);
    }
  };

  const deleteUser = async (id: number) => {
    const target = users.find((u: any) => u.id === id);
    if (!target) return;
    if (target.role === "owner") {
      alert("No podés eliminar al Dueño.");
      return;
    }
    const hasChildren = users.some((u: any) => u.reportsTo === id);
    if (hasChildren) {
      alert("No se puede eliminar: el usuario tiene integrantes a cargo.");
      return;
    }
    try {
      await apiDeleteUser(id);
      setUsers((prev) => prev.filter((u: any) => u.id !== id));
    } catch (e) {
      console.error("No pude eliminar usuario", e);
    }
  };

  // ===== UI: Login =====
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <svg width="48" height="42" viewBox="0 0 40 36" fill="none">
                <path d="M10 2L30 2L35 12L30 22L10 22L5 12Z" fill="url(#gradient2)" />
                <defs>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFB800" />
                    <stop offset="25%" stopColor="#FF6B9D" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="75%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-800">Alluma</h1>
                <p className="text-sm text-gray-600">Publicidad</p>
              </div>
            </div>
            <p className="text-gray-600">Sistema de gestión CRM</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input type="email" id="email" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="tu@alluma.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <input type="password" id="password" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
            </div>
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{loginError}</p>
              </div>
            )}
            <button
              onClick={() =>
                handleLogin(
                  (document.getElementById("email") as HTMLInputElement).value,
                  (document.getElementById("password") as HTMLInputElement).value
                )
              }
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== UI autenticada =====
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="bg-slate-900 text-white w-64 min-h-screen p-4">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="relative">
              <svg width="40" height="36" viewBox="0 0 40 36" fill="none">
                <path d="M10 2L30 2L35 12L30 22L10 22L5 12Z" fill="url(#gradient1)" />
                <defs>
                  <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFB800" />
                    <stop offset="25%" stopColor="#FF6B9D" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="75%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold text-white">Alluma</h1>
              <p className="text-xs text-gray-400">Publicidad</p>
            </div>
          </div>

          <div className="text-sm text-gray-300">
            <p>{currentUser?.name || currentUser?.email}</p>
            <p className="text-blue-300">{roles[currentUser?.role] || currentUser?.role}</p>
          </div>
        </div>
        <nav className="space-y-2">
          {[
            { key: "dashboard", label: "Dashboard", Icon: Home },
            { key: "leads", label: "Leads", Icon: Users },
            { key: "calendar", label: "Calendario", Icon: Calendar },
            { key: "ranking", label: "Ranking", Icon: Trophy },
            ...(["supervisor", "gerente", "director", "owner"].includes(currentUser?.role) ? [{ key: "team", label: "Mi Equipo", Icon: UserCheck }] : []),
            ...(canManageUsers() ? [{ key: "users", label: "Usuarios", Icon: Settings }] : []),
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as any)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === (key as any) ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-slate-800"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div className="flex-1 p-6">
        {/* Modal: Observaciones del Lead */}
        {showObservacionesModal && editingLeadObservaciones && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Observaciones - {editingLeadObservaciones.nombre}
                </h3>
                <button onClick={() => {
                  setShowObservacionesModal(false);
                  setEditingLeadObservaciones(null);
                }}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Cliente:</span> {editingLeadObservaciones.nombre} | 
                  <span className="font-medium ml-2">Teléfono:</span> {editingLeadObservaciones.telefono} | 
                  <span className="font-medium ml-2">Vehículo:</span> {editingLeadObservaciones.modelo}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Estado actual:</span> 
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium text-white ${estados[editingLeadObservaciones.estado].color}`}>
                    {estados[editingLeadObservaciones.estado].label}
                  </span>
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
                <textarea
                  id="observaciones-textarea"
                  defaultValue={editingLeadObservaciones.notas || ""}
                  placeholder="Agregar observaciones sobre el cliente, llamadas realizadas, intereses, objeciones, etc..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex space-x-3 pt-6">
                <button 
                  onClick={() => {
                    const textarea = document.getElementById("observaciones-textarea") as HTMLTextAreaElement;
                    if (textarea && editingLeadObservaciones) {
                      handleUpdateObservaciones(editingLeadObservaciones.id, textarea.value);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Guardar Observaciones
                </button>
                <button 
                  onClick={() => {
                    setShowObservacionesModal(false);
                    setEditingLeadObservaciones(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Nuevo Lead */}
        {showNewLeadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-3xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">Nuevo Lead</h3>
                <button onClick={() => setShowNewLeadModal(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" id="new-nombre" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="text" id="new-telefono" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                  <input type="text" id="new-modelo" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pago</label>
                  <select id="new-formaPago" className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="Contado">Contado</option>
                    <option value="Financiado">Financiado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuente del Lead</label>
                  <select id="new-fuente" className="w-full px-3 py-2 border border-gray-300 rounded-lg" defaultValue="sitio_web">
                    {Object.entries(fuentes).map(([key, fuente]) => (
                      <option key={key} value={key}>
                        {fuente.icon} {fuente.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Info Usado</label>
                  <input type="text" id="new-infoUsado" placeholder="Marca Modelo Año" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" id="new-fecha" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="col-span-2 flex items-center space-x-3">
                  <input type="checkbox" id="new-entrega" className="rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-700">Entrega de vehículo usado</span>
                </div>
                <div className="col-span-2 flex items-center space-x-3">
                  <input type="checkbox" id="new-autoassign" defaultChecked className="rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-700">Asignación automática y equitativa a vendedores activos</span>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a vendedor (opcional)</label>
                  <select id="new-vendedor" className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Sin asignar</option>
                    {users
                      .filter((u: any) => u.role === "vendedor" && visibleUserIds.includes(u.id))
                      .map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.active ? "" : "(inactivo)"}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Si está tildado "Asignación automática", se ignorará esta selección.</p>
                </div>
              </div>
              <div className="flex space-x-3 pt-6">
                <button onClick={() => setShowNewLeadModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleCreateLead} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Crear Lead
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Nuevo Evento */}
        {showNewEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">Nuevo evento</h3>
                <button onClick={() => setShowNewEventModal(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                  <input type="text" id="ev-title" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" id="ev-date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                  <input type="time" id="ev-time" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                  <select id="ev-user" defaultValue={selectedCalendarUserId ?? currentUser?.id} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    {visibleUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {roles[u.role] || u.role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex space-x-3 pt-6">
                <button onClick={createEvent} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Crear evento
                </button>
                <button onClick={() => setShowNewEventModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Crear/Editar Usuario */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">{editingUser ? "Editar usuario" : "Nuevo usuario"}</h3>
                <button onClick={() => setShowUserModal(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" id="u-name" defaultValue={editingUser?.name || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" id="u-email" defaultValue={editingUser?.email || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <input type="password" id="u-pass" placeholder={editingUser ? "(sin cambio)" : ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    id="u-role"
                    value={modalRole}
                    onChange={(e) => {
                      const r = e.target.value as typeof modalRole;
                      setModalRole(r);
                      const managers = validManagersByRole(r);
                      setModalReportsTo(r === "owner" ? null : managers[0]?.id ?? null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {currentUser?.role === "owner" && editingUser?.id === currentUser?.id && <option value="owner">{roles["owner"]}</option>}
                    {validRolesByUser(currentUser).map((role) => (
                      <option key={role} value={role}>
                        {roles[role]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reporta a</label>
                  <select
                    id="u-reportsTo"
                    value={modalReportsTo ?? ""}
                    onChange={(e) => setModalReportsTo(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={modalRole === "owner"}
                  >
                    {modalRole === "owner" ? (
                      <option value="">N/A - Dueño</option>
                    ) : (
                      validManagersByRole(modalRole).map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {roles[m.role] || m.role}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 pt-6">
                <button onClick={saveUser} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Guardar
                </button>
                <button onClick={() => setShowUserModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Topbar con alertas */}
        <div className="flex items-center justify-end mb-4">
          <div className="relative">
            <button onClick={() => setActiveSection("alerts")} className="p-2 rounded-lg hover:bg-gray-200 relative">
              <Bell size={20} />
              {currentUser && unreadCount(currentUser.id) > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1">
                  {unreadCount(currentUser.id)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Dashboard con selector de equipo para Owner/Director */}
        {activeSection === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
              {["owner", "director"].includes(currentUser?.role) && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value as 'roberto' | 'daniel')}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="roberto">Equipo Roberto</option>
                  <option value="daniel">Equipo Daniel</option>
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(() => {
                const stats = getDashboardStats();
                const cards = [
                  { label: "Total Leads", value: stats.totalLeads, Icon: Users },
                  { label: "Vendidos", value: stats.vendidos, Icon: BarChart3 },
                  { label: "Conversión", value: stats.conversion + "%", Icon: BarChart3 },
                ];
                return cards.map(({ label, value, Icon }, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm font-medium">{label}</p>
                        <p className="text-3xl font-bold text-gray-800">{value}</p>
                      </div>
                      <Icon className="text-blue-500" size={32} />
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Leads por Estado</h3>
                {selectedEstado && (
                  <button 
                    onClick={() => setSelectedEstado(null)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <X size={16} />
                    <span>Cerrar filtro</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(estados).map(([key, estado]) => {
                  const count = getFilteredLeads().filter((l) => l.estado === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                      className={`text-center transition-all duration-200 transform hover:scale-105 ${
                        selectedEstado === key ? "ring-4 ring-blue-300 ring-opacity-50" : ""
                      }`}
                      title={`Ver todos los leads en estado: ${estado.label}`}
                    >
                      <div className={`${estado.color} text-white rounded-lg p-4 mb-2 hover:opacity-90`}>
                        <div className="text-2xl font-bold">{count}</div>
                      </div>
                      <div className="text-sm text-gray-600">{estado.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Lista filtrada de leads por estado */}
              {selectedEstado && (
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">
                    Leads en estado: <span className={`px-3 py-1 rounded-full text-white text-sm ${estados[selectedEstado].color}`}>
                      {estados[selectedEstado].label}
                    </span>
                  </h4>
                  
                  {(() => {
                    const leadsFiltrados = getFilteredLeads().filter(l => l.estado === selectedEstado);
                    
                    if (leadsFiltrados.length === 0) {
                      return (
                        <p className="text-gray-500 text-center py-8">
                          No hay leads en estado "{estados[selectedEstado].label}"
                        </p>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {leadsFiltrados.map((lead) => {
                              const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                              return (
                                <tr key={lead.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2">
                                    <div className="font-medium text-gray-900">{lead.nombre}</div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center space-x-1">
                                      <Phone size={12} className="text-gray-400" />
                                      <span className="text-gray-700">{lead.telefono}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div>
                                      <div className="font-medium text-gray-900">{lead.modelo}</div>
                                      <div className="text-xs text-gray-500">{lead.formaPago}</div>
                                      {lead.infoUsado && <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center space-x-1">
                                      <span className="text-sm">{fuentes[lead.fuente as string]?.icon || "❓"}</span>
                                      <span className="text-xs text-gray-600">
                                        {fuentes[lead.fuente as string]?.label || String(lead.fuente)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-gray-700">
                                    {vendedor?.name || "Sin asignar"}
                                  </td>
                                  <td className="px-4 py-2 text-gray-500 text-xs">
                                    {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <div className="flex items-center justify-center space-x-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingLeadObservaciones(lead);
                                          setShowObservacionesModal(true);
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                        title="Ver/Editar observaciones"
                                      >
                                        {lead.notas && lead.notas.length > 0 ? "Ver" : "Obs"}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveSection("leads");
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        title="Ver en tabla completa"
                                      >
                                        Ver
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {["owner", "director", "gerente"].includes(currentUser?.role) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Rendimiento por Fuente de Lead</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getSourceMetrics().map((source) => (
                    <div key={source.source} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">{source.icon}</span>
                          <h4 className="font-medium text-gray-800">{source.label}</h4>
                        </div>
                        <span className={`${source.color} text-white px-2 py-1 rounded-full text-xs font-bold`}>{source.conversion}%</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total leads:</span>
                          <span className="font-medium">{source.total}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Vendidos:</span>
                          <span className="font-medium text-green-600">{source.vendidos}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className={`${source.color} h-2 rounded-full`} style={{ width: `${source.conversion}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {getSourceMetrics().length === 0 && <p className="text-gray-500 text-center py-8">No hay leads con fuentes registradas</p>}
              </div>
            )}
          </div>
        )}

        {/* Continue with other sections (team, alerts, leads, etc.) exactly as they were in the original */}
        
        {/* Add all the other sections here ... */}
        
      </div>
    </div>
  );
}