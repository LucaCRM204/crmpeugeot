import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Users, Trophy, Plus, Phone, BarChart3, Settings, Home, X, Trash2, Edit3, Bell } from "lucide-react";
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
};

const fuentes: Record<string, { label: string; color: string; icon: string }> = {
  meta: { label: "Meta/Facebook", color: "bg-blue-600", icon: "📱" },
  whatsapp: { label: "WhatsApp Bot", color: "bg-green-500", icon: "💬" },
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
  const [activeSection, setActiveSection] = useState<"dashboard" | "leads" | "calendar" | "ranking" | "users" | "alerts">("dashboard");
  const [loginError, setLoginError] = useState("");

  // ===== Login contra backend =====
  const handleLogin = async (email: string, password: string) => {
    try {
      const r = await api.post("/api/auth/login", { email, password, useCookie: false });
      const u = r.data?.user || {
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

      // Cargar datos persistidos
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
      }));
      setUsers(uu || []);
      setLeads(mappedLeads);
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
  });

  const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { estado: newStatus });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l)));
    } catch (e) {
      console.error("No pude actualizar estado del lead", e);
    }
  };

  // ===== Crear Lead (API) =====
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
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

        {/* Dashboard */}
        {activeSection === "dashboard" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
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
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Leads por Estado</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {Object.entries(estados).map(([key, estado]) => {
                  const count = getFilteredLeads().filter((l) => l.estado === key).length;
                  return (
                    <div key={key} className="text-center">
                      <div className={`${estado.color} text-white rounded-lg p-4 mb-2`}>
                        <div className="text-2xl font-bold">{count}</div>
                      </div>
                      <div className="text-sm text-gray-600">{estado.label}</div>
                    </div>
                  );
                })}
              </div>
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
                        <td className="px-6 py-4 text-right text-sm">
                          {(currentUser?.role === "owner" || currentUser?.role === "director") && (
                            <button
                              onClick={async () => {
                                try {
                                  await apiDeleteLead(lead.id);
                                  setLeads((prev) => prev.filter((l) => l.id !== lead.id));
                                } catch (e) {
                                  console.error("No pude eliminar lead", e);
                                }
                              }}
                              className="inline-flex items-center px-2 py-1 text-sm rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                              title="Eliminar lead"
                            >
                              <Trash2 size={14} className="mr-1" /> Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Calendario */}
        {activeSection === "calendar" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Calendario</h2>
              <div className="flex items-center space-x-3">
                <select
                  value={selectedCalendarUserId ?? currentUser?.id}
                  onChange={(e) => setSelectedCalendarUserId(parseInt(e.target.value, 10))}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  {visibleUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {roles[u.role] || u.role}
                    </option>
                  ))}
                </select>
                <button onClick={() => setShowNewEventModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700">
                  <Plus size={18} />
                  <span>Nuevo evento</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Próximos eventos</h3>
              </div>
              {eventsForSelectedUser.length === 0 ? (
                <p className="text-gray-500 text-sm">Sin eventos para este usuario.</p>
              ) : (
                <div className="space-y-3">
                  {eventsForSelectedUser.map((event: any) => {
                    const d = new Date(`${event.date}T${event.time || "09:00"}`);
                    const fecha = formatterEs.format(d);
                    const hora = (event.time || "").slice(0, 5);
                    return (
                      <div key={event.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="bg-blue-500 text-white p-2 rounded-lg mr-4">
                            <Calendar size={20} />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">{event.title}</h4>
                            <p className="text-sm text-gray-600 capitalize">
                              {fecha} {hora && `· ${hora} hs`}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => deleteEvent(event.id)} className="p-2 rounded-lg hover:bg-red-100 text-red-600">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ranking */}
        {activeSection === "ranking" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Ranking de Vendedores</h2>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="space-y-4">
                {getRankingInScope().map((vendedor, index) => (
                  <div key={vendedor.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : "bg-orange-600"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800">{vendedor.nombre}</h4>
                        <p className="text-sm text-gray-600">{vendedor.team}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-800">{vendedor.ventas}</p>
                      <p className="text-xs text-gray-600">ventas</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Usuarios */}
        {activeSection === "users" && canManageUsers() && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h2>
              <button onClick={openCreateUser} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700">
                <Plus size={18} />
                <span>Nuevo usuario</span>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reporta a</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user: any) => {
                    const canToggle =
                      ["gerente", "supervisor", "owner", "director"].includes(currentUser.role) &&
                      user.role === "vendedor" &&
                      getAccessibleUserIds(currentUser).includes(user.id);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {roles[user.role] || user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{user.reportsTo ? userById.get(user.reportsTo)?.name : "—"}</td>
                        <td className="px-6 py-4 text-right">
                          {canToggle ? (
                            <button
                              onClick={async () => {
                                try {
                                  const updated = await apiUpdateUser(user.id, { active: user.active ? 0 : 1 });
                                  setUsers((prev) => prev.map((u: any) => (u.id === user.id ? updated : u)));
                                } catch (e) {
                                  console.error("No pude cambiar estado", e);
                                }
                              }}
                              className={`inline-flex items-center px-2 py-1 text-xs rounded-md ${
                                user.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              {user.active ? "Activo" : "Inactivo"}
                            </button>
                          ) : (
                            <span className={`px-2 py-1 text-xs rounded-md ${user.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                              {user.active ? "Activo" : "Inactivo"}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {isOwner() && (
                            <>
                              <button
  onClick={() => { setEditingUser(user); openEditUser(user); }}
  className="inline-flex items-center px-2 py-1 text-sm rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200"
>
  <Edit3 size={14} className="mr-1" /> Editar
</button>
                              <button onClick={() => deleteUser(user.id)} className="inline-flex items-center px-2 py-1 text-sm rounded-md bg-red-100 text-red-700 hover:bg-red-200">
                                <Trash2 size={14} className="mr-1" /> Eliminar
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                    {(modalRole === "owner" ? [] : validManagersByRole(modalRole)).map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {roles[m.role] || m.role}
                      </option>
                    ))}
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
}
