﻿import { useEffect, useMemo, useRef, useState } from "react";
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

// Configuración de bots
const botConfig: Record<string, { targetTeam: string | null; label: string }> = {
  whatsapp_bot_cm1: { targetTeam: "sauer", label: "Bot CM 1" },
  whatsapp_bot_cm2: { targetTeam: "daniel", label: "Bot CM 2" },
  whatsapp_100: { targetTeam: null, label: "Bot 100" }, // null = distribución general
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
  const [selectedTeam, setSelectedTeam] = useState<string>('todos');

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

  // ===== Funciones de filtro por equipo =====
  const getTeamManagerById = (teamId: string) => {
    if (teamId === 'todos') return null;
    return users.find((u: any) => u.role === "gerente" && u.id.toString() === teamId);
  };

  const getTeamUserIds = (teamId: string) => {
    if (teamId === 'todos') return [];
    const manager = getTeamManagerById(teamId);
    if (!manager) return [];
    
    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return [manager.id, ...descendants];
  };

  const getFilteredLeadsByTeam = (teamId?: string) => {
    if (!currentUser) return [] as LeadRow[];
    
    if (teamId && teamId !== 'todos' && ["owner", "director"].includes(currentUser.role)) {
      // Filtrar por equipo específico usando ID
      const teamUserIds = getTeamUserIds(teamId);
      return leads.filter((l) => (l.vendedor ? teamUserIds.includes(l.vendedor) : false));
    }
    
    // Filtro normal por scope del usuario
    const visibleUserIds = getAccessibleUserIds(currentUser);
    return leads.filter((l) => (l.vendedor ? visibleUserIds.includes(l.vendedor) : true));
  };

  // ===== Round-robin con soporte para bots específicos =====
  const [rrIndex, setRrIndex] = useState(0);
  
  const getActiveVendorIdsInScope = (scopeUser?: any) => {
    if (!scopeUser) return [] as number[];
    const scope = getAccessibleUserIds(scopeUser);
    return users.filter((u: any) => u.role === "vendedor" && u.active && scope.includes(u.id)).map((u: any) => u.id);
  };

  const getVendorsByTeam = (teamName: string) => {
    // Buscar el gerente del equipo por nombre
    const manager = users.find((u: any) => 
      u.role === "gerente" && 
      u.name.toLowerCase().includes(teamName.toLowerCase())
    );
    
    if (!manager) return [];

    // Obtener todos los descendientes del gerente
    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return users.filter((u: any) => 
      u.role === "vendedor" && 
      u.active && 
      descendants.includes(u.id)
    ).map((u: any) => u.id);
  };

  const pickNextVendorId = (scopeUser?: any, botSource?: string) => {
    let pool: number[] = [];

    if (botSource && botConfig[botSource]) {
      const botConf = botConfig[botSource];
      if (botConf.targetTeam) {
        // Bot específico para un equipo
        pool = getVendorsByTeam(botConf.targetTeam);
      } else {
        // Bot 100 - distribución general
        pool = getActiveVendorIdsInScope(scopeUser || currentUser);
      }
    } else {
      // Asignación manual normal
      pool = getActiveVendorIdsInScope(scopeUser || currentUser);
    }

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

  // ===== Nueva función para filtrar usuarios visibles según rol =====
  const getVisibleUsers = () => {
    if (!currentUser) return [];
    
    return users.filter((u: any) => {
      // Owner ve a todos
      if (currentUser.role === "owner") return true;
      
      // Director ve a todos menos al owner
      if (currentUser.role === "director") return u.role !== "owner";
      
      // Gerente solo ve a su equipo
      if (currentUser.role === "gerente") {
        // Ve a sí mismo
        if (u.id === currentUser.id) return true;
        
        // Ve a sus supervisores directos
        if (u.reportsTo === currentUser.id) return true;
        
        // Ve a los vendedores que reportan a sus supervisores
        const userSupervisor = userById.get(u.reportsTo);
        return userSupervisor && userSupervisor.reportsTo === currentUser.id;
      }
      
      // Supervisor solo ve a su equipo directo
      if (currentUser.role === "supervisor") {
        // Ve a sí mismo
        if (u.id === currentUser.id) return true;
        
        // Ve a sus vendedores directos
        return u.reportsTo === currentUser.id;
      }
      
      return false;
    });
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

  const getDashboardStats = (teamFilter?: string) => {
    const filteredLeads = teamFilter && teamFilter !== 'todos' ? getFilteredLeadsByTeam(teamFilter) : getFilteredLeads();
    const vendidos = filteredLeads.filter((lead) => lead.estado === "vendido").length;
    const conversion = filteredLeads.length > 0 ? ((vendidos / filteredLeads.length) * 100).toFixed(1) : 0;
    return { totalLeads: filteredLeads.length, vendidos, conversion };
  };

  const getSourceMetrics = (teamFilter?: string) => {
    const filteredLeads = teamFilter && teamFilter !== 'todos' ? getFilteredLeadsByTeam(teamFilter) : getFilteredLeads();
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
    
    // Detectar si es un bot y asignar según configuración
    let vendedorId: number | null = null;
    if (autoAssign) {
      vendedorId = pickNextVendorId(currentUser, fuente) ?? vendedorIdSel ?? null;
    } else {
      vendedorId = vendedorIdSel ?? null;
    }

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
          vendedor: vendedorId,
        } as any);
        const mapped = mapLeadFromApi(created);
        if (mapped.vendedor) pushAlert(mapped.vendedor, "lead_assigned", `Nuevo lead asignado: ${mapped.nombre}`);
        setLeads((prev) => [mapped, ...prev]);
        setShowNewLeadModal(false);
        
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
    () => (currentUser ? getVisibleUsers() : []),
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
    const validManagers = validManagersByRole(roleDefault);
    setModalRole(roleDefault);
    setModalReportsTo(validManagers[0]?.id ?? null);
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
    const validManagers = validManagersByRole(roleToSet);
    setModalRole(roleToSet as any);
    setModalReportsTo(roleToSet === "owner" ? null : u.reportsTo ?? validManagers[0]?.id ?? null);
    setShowUserModal(true);
  };

  const saveUser = async () => {
    const name = (document.getElementById("u-name") as HTMLInputElement).value.trim();
    const email = (document.getElementById("u-email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("u-pass") as HTMLInputElement).value;
    const active = (document.getElementById("u-active") as HTMLInputElement).checked;
    
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
          active: active ? 1 : 0,
        });
        setUsers((prev) => prev.map((u: any) => (u.id === editingUser.id ? updated : u)));
      } else {
        const created = await apiCreateUser({
          name,
          email,
          password: password || "123456",
          role: modalRole,
          reportsTo: finalReportsTo,
          active: active ? 1 : 0,
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

        {/* Modal: Historial del Lead */}
        {showHistorialModal && viewingLeadHistorial && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Historial - {viewingLeadHistorial.nombre}
                </h3>
                <button onClick={() => {
                  setShowHistorialModal(false);
                  setViewingLeadHistorial(null);
                }}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Cliente:</span> {viewingLeadHistorial.nombre} | 
                  <span className="font-medium ml-2">Teléfono:</span> {viewingLeadHistorial.telefono} | 
                  <span className="font-medium ml-2">Vehículo:</span> {viewingLeadHistorial.modelo}
                </p>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {(viewingLeadHistorial.historial || []).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay historial disponible para este lead</p>
                ) : (
                  <div className="space-y-3">
                    {viewingLeadHistorial.historial?.map((entry, index) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${estados[entry.estado]?.color || 'bg-gray-500'}`}>
                            {estados[entry.estado]?.label || entry.estado}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleDateString('es-AR')} {new Date(entry.timestamp).toLocaleTimeString('es-AR')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">Actualizado por: {entry.usuario}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end pt-6">
                <button 
                  onClick={() => {
                    setShowHistorialModal(false);
                    setViewingLeadHistorial(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cerrar
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
                    {/* Opciones específicas para bots */}
                    <option value="whatsapp_bot_cm1">💬 Bot CM 1 (Equipo Sauer)</option>
                    <option value="whatsapp_bot_cm2">💬 Bot CM 2 (Equipo Daniel)</option>
                    <option value="whatsapp_100">💬 Bot 100 (Distribución general)</option>
                  </select>
                  <div className="mt-2 text-xs space-y-1">
                    {(() => {
                      const robertoManager = users.find((u: any) => u.role === "gerente" && u.name.toLowerCase().includes("roberto"));
                      const danielManager = users.find((u: any) => u.role === "gerente" && u.name.toLowerCase().includes("daniel"));
                      
                      return (
                        <>
                          {robertoManager && (
                            <div className="text-green-600">💬 Bot CM 1 → Equipo {robertoManager.name} automáticamente</div>
                          )}
                          {danielManager && (
                            <div className="text-green-600">💬 Bot CM 2 → Equipo {danielManager.name} automáticamente</div>
                          )}
                          <div className="text-green-600">💬 Bot 100 → Distribución general</div>
                          <div className="text-gray-500">Otras fuentes → Asignación manual o scope actual</div>
                        </>
                      );
                    })()}
                  </div>
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
                    {getVisibleUsers()
                      .filter((u: any) => u.role === "vendedor")
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
                      const validManagers = validManagersByRole(r);
                      setModalReportsTo(r === "owner" ? null : validManagers[0]?.id ?? null);
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

                <div className="col-span-2 flex items-center space-x-3">
                  <input 
                    type="checkbox" 
                    id="u-active" 
                    defaultChecked={editingUser ? editingUser.active : true} 
                    className="rounded border-gray-300 text-blue-600" 
                  />
                  <span className="text-sm text-gray-700">Usuario activo (puede recibir leads automáticamente)</span>
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

        {/* Dashboard */}
        {activeSection === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
              {["owner", "director"].includes(currentUser?.role) && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="todos">Todos los equipos</option>
                  {users
                    .filter((u: any) => u.role === "gerente")
                    .map((gerente: any) => (
                      <option key={gerente.id} value={gerente.id}>
                        Equipo {gerente.name}
                      </option>
                    ))
                  }
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(() => {
                const teamFilter = ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined;
                const stats = getDashboardStats(teamFilter);
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
                  const teamFilter = ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined;
                  const filteredLeads = teamFilter && teamFilter !== 'todos' ? getFilteredLeadsByTeam(teamFilter) : getFilteredLeads();
                  const count = filteredLeads.filter((l) => l.estado === key).length;
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
                    const teamFilter = ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined;
                    const filteredLeads = teamFilter && teamFilter !== 'todos' ? getFilteredLeadsByTeam(teamFilter) : getFilteredLeads();
                    const leadsFiltrados = filteredLeads.filter(l => l.estado === selectedEstado);
                    
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
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
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
                  {(() => {
                    const teamFilter = ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined;
                    return getSourceMetrics(teamFilter && teamFilter !== 'todos' ? teamFilter : undefined).map((source) => (
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
                    ));
                  })()}
                </div>
                {(() => {
                  const teamFilter = ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined;
                  return getSourceMetrics(teamFilter && teamFilter !== 'todos' ? teamFilter : undefined).length === 0;
                })() && <p className="text-gray-500 text-center py-8">No hay leads con fuentes registradas</p>}
              </div>
            )}
          </div>
        )}

        {/* Sección Leads */}
        {activeSection === "leads" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Gestión de Leads</h2>
              <button
                onClick={() => setShowNewLeadModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                <span>Nuevo Lead</span>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehículo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fuente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendedor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredLeads().map((lead) => {
                      const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                      return (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">{lead.nombre}</div>
                            {lead.notas && (
                              <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                                {lead.notas.substring(0, 50)}...
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-1">
                              <Phone size={12} className="text-gray-400" />
                              <span className="text-sm text-gray-700">{lead.telefono}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{lead.modelo}</div>
                              <div className="text-xs text-gray-500">{lead.formaPago}</div>
                              {lead.infoUsado && (
                                <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>
                              )}
                              {lead.entrega && (
                                <div className="text-xs text-blue-600">Entrega incluida</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <select
                              value={lead.estado}
                              onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                              className={`text-xs font-medium px-2 py-1 rounded-full text-white border-0 ${estados[lead.estado].color}`}
                            >
                              {Object.entries(estados).map(([key, estado]) => (
                                <option key={key} value={key} className="text-gray-900">
                                  {estado.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-1">
                              <span className="text-sm">{fuentes[lead.fuente as string]?.icon || "❓"}</span>
                              <span className="text-xs text-gray-600">
                                {fuentes[lead.fuente as string]?.label || String(lead.fuente)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            {vendedor?.name || "Sin asignar"}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => {
                                  setEditingLeadObservaciones(lead);
                                  setShowObservacionesModal(true);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800"
                                title="Ver/Editar observaciones"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setViewingLeadHistorial(lead);
                                  setShowHistorialModal(true);
                                }}
                                className="p-1 text-green-600 hover:text-green-800"
                                title="Ver historial"
                              >
                                <Calendar size={16} />
                              </button>
                              {canManageUsers() && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`¿Estás seguro de eliminar el lead de ${lead.nombre}?`)) {
                                      try {
                                        await apiDeleteLead(lead.id);
                                        setLeads((prev) => prev.filter((l) => l.id !== lead.id));
                                      } catch (e) {
                                        console.error("No pude eliminar el lead", e);
                                      }
                                    }
                                  }}
                                  className="p-1 text-red-600 hover:text-red-800"
                                  title="Eliminar lead"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {getFilteredLeads().length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No hay leads para mostrar</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sección Calendario */}
        {activeSection === "calendar" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Calendario</h2>
              <div className="flex items-center space-x-3">
                <select
                  value={selectedCalendarUserId ?? ""}
                  onChange={(e) => setSelectedCalendarUserId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Mi calendario</option>
                  {visibleUsers
                    .filter((u: any) => u.id !== currentUser?.id)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {roles[u.role] || u.role}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => setShowNewEventModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Evento</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Próximos eventos - {selectedCalendarUserId ? userById.get(selectedCalendarUserId)?.name : "Mi calendario"}
              </h3>
              
              {eventsForSelectedUser.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay eventos programados</p>
              ) : (
                <div className="space-y-3">
                  {eventsForSelectedUser.map((event: any) => (
                    <div key={event.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div>
                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                        <p className="text-sm text-gray-600">
                          {formatterEs.format(new Date(event.date))} a las {event.time}
                        </p>
                        <p className="text-xs text-gray-500">
                          {userById.get(event.userId)?.name || "Usuario desconocido"}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="p-2 text-red-600 hover:text-red-800"
                          title="Eliminar evento"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sección Ranking */}
        {activeSection === "ranking" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Ranking de Vendedores</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ranking General */}
              {isOwner() && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Ranking General</h3>
                  <div className="space-y-3">
                    {getRanking().map((vendedor, index) => (
                      <div key={vendedor.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{vendedor.nombre}</p>
                            <p className="text-xs text-gray-500">{vendedor.team}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{vendedor.ventas} ventas</p>
                          <p className="text-xs text-gray-500">{vendedor.leadsAsignados} leads asignados</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {getRanking().length === 0 && (
                    <p className="text-gray-500 text-center py-8">No hay vendedores registrados</p>
                  )}
                </div>
              )}

              {/* Ranking en Mi Scope */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  {isOwner() ? "Mi Scope" : "Ranking"}
                </h3>
                <div className="space-y-3">
                  {getRankingInScope().map((vendedor, index) => (
                    <div key={vendedor.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{vendedor.nombre}</p>
                          <p className="text-xs text-gray-500">{vendedor.team}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{vendedor.ventas} ventas</p>
                        <p className="text-xs text-gray-500">{vendedor.leadsAsignados} leads asignados</p>
                      </div>
                    </div>
                  ))}
                </div>
                {getRankingInScope().length === 0 && (
                  <p className="text-gray-500 text-center py-8">No hay vendedores en tu scope</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sección Mi Equipo */}
        {activeSection === "team" && ["supervisor", "gerente", "director", "owner"].includes(currentUser?.role) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Mi Equipo</h2>
              {["owner", "director"].includes(currentUser?.role) && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="todos">Todos los equipos</option>
                  {users
                    .filter((u: any) => u.role === "gerente")
                    .map((gerente: any) => (
                      <option key={gerente.id} value={gerente.id}>
                        Equipo {gerente.name}
                      </option>
                    ))
                  }
                </select>
              )}
            </div>
            
            {/* Estadísticas por estado tipo dashboard */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Estados de Leads - Mi Equipo</h3>
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
                  const teamFilter = ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined;
                  const filteredLeads = teamFilter && teamFilter !== 'todos' ? getFilteredLeadsByTeam(teamFilter) : getFilteredLeads();
                  const count = filteredLeads.filter((l) => l.estado === key).length;
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

              {/* Lista filtrada de leads por estado en Mi Equipo */}
              {selectedEstado && (
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">
                    Leads de mi equipo en estado: <span className={`px-3 py-1 rounded-full text-white text-sm ${estados[selectedEstado].color}`}>
                      {estados[selectedEstado].label}
                    </span>
                  </h4>
                  
                  {(() => {
                    const teamFilter = ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined;
                    const filteredLeads = teamFilter && teamFilter !== 'todos' ? getFilteredLeadsByTeam(teamFilter) : getFilteredLeads();
                    const leadsFiltrados = filteredLeads.filter(l => l.estado === selectedEstado);
                    
                    if (leadsFiltrados.length === 0) {
                      return (
                        <p className="text-gray-500 text-center py-8">
                          No hay leads de tu equipo en estado "{estados[selectedEstado].label}"
                        </p>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
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

            {/* Top vendedores en mi organización */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Top Vendedores en Mi Organización</h3>
              <div className="space-y-3">
                {getRankingInScope().map((vendedor, index) => (
                  <div key={vendedor.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{vendedor.nombre}</p>
                        <p className="text-xs text-gray-500">{vendedor.team}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{vendedor.ventas} ventas</p>
                      <p className="text-xs text-gray-500">
                        {vendedor.leadsAsignados} leads • {vendedor.leadsAsignados > 0 ? ((vendedor.ventas / vendedor.leadsAsignados) * 100).toFixed(0) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {getRankingInScope().length === 0 && (
                <p className="text-gray-500 text-center py-8">No hay vendedores en tu equipo</p>
              )}
            </div>

            {/* Estructura organizacional */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Estructura Organizacional</h3>
              <div className="space-y-8">
                {(() => {
                  const visibleUsers = getVisibleUsers();
                  
                  if (currentUser?.role === "owner" || currentUser?.role === "director") {
                    // Owner y Director ven todos los gerentes (o filtrados por equipo)
                    const gerentes = visibleUsers.filter((u: any) => u.role === "gerente");
                    
                    // Filtrar gerentes según selectedTeam
                    const gerentesAMostrar = selectedTeam === 'todos' 
                      ? gerentes
                      : gerentes.filter((g: any) => g.id.toString() === selectedTeam);
                    
                    return gerentesAMostrar.map((gerente: any, gerenteIndex: number) => {
                      const supervisores = visibleUsers.filter((u: any) => u.reportsTo === gerente.id);
                      const gerenteLeads = leads.filter((l) => l.vendedor === gerente.id);
                      const gerenteVentas = gerenteLeads.filter((l) => l.estado === "vendido").length;
                      
                      // Colores distintos para cada gerente
                      const gerenteColors = [
                        { bg: "bg-blue-600", border: "border-blue-200", accent: "bg-blue-50" },
                        { bg: "bg-purple-600", border: "border-purple-200", accent: "bg-purple-50" },
                        { bg: "bg-indigo-600", border: "border-indigo-200", accent: "bg-indigo-50" },
                        { bg: "bg-teal-600", border: "border-teal-200", accent: "bg-teal-50" },
                      ];
                      const colorScheme = gerenteColors[gerenteIndex % gerenteColors.length];
                      
                      return (
                        <div key={gerente.id} className={`border-2 ${colorScheme.border} ${colorScheme.accent} rounded-xl p-6 shadow-md`}>
                          {/* Header del Gerente */}
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-4">
                              <div className={`w-16 h-16 ${colorScheme.bg} rounded-full flex items-center justify-center shadow-lg`}>
                                <span className="text-white font-bold text-lg">
                                  {gerente.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-xl font-bold text-gray-900">{gerente.name}</h4>
                                <p className="text-sm font-medium text-gray-600 mb-1">🏢 Gerente</p>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                  <span>📊 {supervisores.length} supervisores</span>
                                  <span>👥 {supervisores.reduce((total, sup) => total + visibleUsers.filter(u => u.reportsTo === sup.id).length, 0)} vendedores</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right bg-white rounded-lg p-4 shadow-sm border">
                              <p className="text-2xl font-bold text-green-600">{gerenteVentas}</p>
                              <p className="text-sm text-gray-500">ventas totales</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {gerenteLeads.length} leads • {gerenteLeads.length > 0 ? ((gerenteVentas / gerenteLeads.length) * 100).toFixed(0) : 0}%
                              </p>
                            </div>
                          </div>
                          
                          {/* Mensaje cuando no hay supervisores */}
                          {supervisores.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                              <div className="text-4xl mb-2">👨‍💼</div>
                              <h5 className="text-lg font-medium text-gray-700 mb-2">
                                {gerente.name} aún no tiene supervisores asignados
                              </h5>
                              <p className="text-sm text-gray-500">
                                Ve a la sección "Usuarios" para asignar supervisores a este gerente
                              </p>
                            </div>
                          ) : (
                            /* Supervisores del gerente */
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {supervisores.map((supervisor: any) => {
                                const vendedores = visibleUsers.filter((u: any) => u.reportsTo === supervisor.id);
                                const supervisorLeads = leads.filter((l) => 
                                  vendedores.some((v: any) => v.id === l.vendedor)
                                );
                                const supervisorVentas = supervisorLeads.filter((l) => l.estado === "vendido").length;
                                
                                return (
                                  <div key={supervisor.id} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                                    {/* Header del Supervisor */}
                                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                          <span className="text-white font-medium text-sm">
                                            {supervisor.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                                          </span>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-gray-900">{supervisor.name}</p>
                                          <p className="text-xs text-gray-500">👨‍💼 Supervisor • {vendedores.length} vendedores</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-bold text-green-600">{supervisorVentas}</p>
                                        <p className="text-xs text-gray-500">{supervisorLeads.length} leads</p>
                                      </div>
                                    </div>
                                    
                                    {/* Vendedores del supervisor */}
                                    {vendedores.length === 0 ? (
                                      <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="text-2xl mb-1">👤</div>
                                        <p className="text-sm font-medium text-gray-600">
                                          {supervisor.name} no tiene vendedores asignados
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                          Asigna vendedores en la sección "Usuarios"
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {vendedores.map((vendedor: any) => {
                                          const vendedorLeads = leads.filter((l) => l.vendedor === vendedor.id);
                                          const vendedorVentas = vendedorLeads.filter((l) => l.estado === "vendido").length;
                                          const conversion = vendedorLeads.length > 0 ? ((vendedorVentas / vendedorLeads.length) * 100).toFixed(0) : "0";
                                          
                                          return (
                                            <div key={vendedor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                              <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                                                  <span className="text-white font-medium text-xs">
                                                    {vendedor.name.split(' ')[0][0]}
                                                  </span>
                                                </div>
                                                <div>
                                                  <span className="font-medium text-gray-900">{vendedor.name}</span>
                                                  {!vendedor.active && <span className="ml-2 text-red-500 text-xs font-medium">(Inactivo)</span>}
                                                  <div className="text-xs text-gray-500">
                                                    {vendedorLeads.length} leads asignados
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <span className="font-bold text-green-600 text-lg">{vendedorVentas}</span>
                                                <div className="text-xs text-gray-500">
                                                  {conversion}% conversión
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    });
                  } else if (currentUser?.role === "gerente") {
                    // Gerente ve solo su equipo
                    const supervisores = visibleUsers.filter((u: any) => u.reportsTo === currentUser.id);
                    
                    return (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {currentUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{currentUser.name} (Tú)</h4>
                              <p className="text-sm text-gray-500">Gerente</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{supervisores.length} supervisores</p>
                          </div>
                        </div>
                        
                        {/* Supervisores */}
                        <div className="ml-6 space-y-3">
                          {supervisores.map((supervisor: any) => {
                            const vendedores = visibleUsers.filter((u: any) => u.reportsTo === supervisor.id);
                            const supervisorLeads = leads.filter((l) => 
                              vendedores.some((v: any) => v.id === l.vendedor)
                            );
                            const supervisorVentas = supervisorLeads.filter((l) => l.estado === "vendido").length;
                            
                            return (
                              <div key={supervisor.id} className="border-l-2 border-gray-300 pl-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                      <span className="text-white font-medium text-xs">
                                        {supervisor.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900 text-sm">{supervisor.name}</p>
                                      <p className="text-xs text-gray-500">Supervisor • {vendedores.length} vendedores</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-green-600">{supervisorVentas} ventas</p>
                                    <p className="text-xs text-gray-500">{supervisorLeads.length} leads</p>
                                  </div>
                                </div>
                                
                                {/* Vendedores del supervisor */}
                                <div className="ml-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {vendedores.map((vendedor: any) => {
                                    const vendedorLeads = leads.filter((l) => l.vendedor === vendedor.id);
                                    const vendedorVentas = vendedorLeads.filter((l) => l.estado === "vendido").length;
                                    const conversion = vendedorLeads.length > 0 ? ((vendedorVentas / vendedorLeads.length) * 100).toFixed(0) : "0";
                                    
                                    return (
                                      <div key={vendedor.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                        <div className="flex items-center space-x-2">
                                          <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                                            <span className="text-white font-medium text-xs">
                                              {vendedor.name.split(' ')[0][0]}
                                            </span>
                                          </div>
                                          <span className="text-gray-900">{vendedor.name}</span>
                                          {!vendedor.active && <span className="text-red-500 text-xs">(Inactivo)</span>}
                                        </div>
                                        <div className="text-right">
                                          <span className="font-medium text-green-600">{vendedorVentas}</span>
                                          <span className="text-gray-500 ml-1">({conversion}%)</span>
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
                  } else if (currentUser?.role === "supervisor") {
                    // Supervisor ve solo sus vendedores
                    const vendedores = visibleUsers.filter((u: any) => u.reportsTo === currentUser.id);
                    
                    return (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {currentUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{currentUser.name} (Tú)</h4>
                              <p className="text-sm text-gray-500">Supervisor</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{vendedores.length} vendedores</p>
                          </div>
                        </div>
                        
                        {/* Vendedores */}
                        <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {vendedores.map((vendedor: any) => {
                            const vendedorLeads = leads.filter((l) => l.vendedor === vendedor.id);
                            const vendedorVentas = vendedorLeads.filter((l) => l.estado === "vendido").length;
                            const conversion = vendedorLeads.length > 0 ? ((vendedorVentas / vendedorLeads.length) * 100).toFixed(0) : "0";
                            
                            return (
                              <div key={vendedor.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                                    <span className="text-white font-medium text-xs">
                                      {vendedor.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{vendedor.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {vendedorLeads.length} leads asignados
                                      {!vendedor.active && <span className="text-red-500"> (Inactivo)</span>}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-green-600">{vendedorVentas} ventas</p>
                                  <p className="text-xs text-gray-500">{conversion}% conversión</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Sección Usuarios */}
        {activeSection === "users" && canManageUsers() && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h2>
              <button
                onClick={openCreateUser}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                <span>Nuevo Usuario</span>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reporta a</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getVisibleUsers().map((user: any) => {
                      const userLeads = leads.filter((l) => l.vendedor === user.id);
                      const userSales = userLeads.filter((l) => l.estado === "vendido").length;
                      const manager = user.reportsTo ? userById.get(user.reportsTo) : null;
                      
                      return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div>
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {roles[user.role] || user.role}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            {manager?.name || "—"}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {user.active ? 'Activo' : 'Inactivo'}
                              </span>
                              {user.role === "vendedor" && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const updated = await apiUpdateUser(user.id, {
                                        ...user,
                                        active: user.active ? 0 : 1,
                                      });
                                      setUsers((prev) => prev.map((u: any) => (u.id === user.id ? updated : u)));
                                    } catch (e) {
                                      console.error("No pude cambiar estado del usuario", e);
                                    }
                                  }}
                                  className={`px-2 py-1 text-xs rounded ${
                                    user.active 
                                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  }`}
                                  title={user.active ? "Desactivar vendedor" : "Activar vendedor"}
                                >
                                  {user.active ? 'Desactivar' : 'Activar'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {user.role === "vendedor" ? (
                              <div className="text-sm">
                                <div>{userLeads.length} leads</div>
                                <div className="text-green-600 font-medium">{userSales} ventas</div>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => openEditUser(user)}
                                className="p-1 text-blue-600 hover:text-blue-800"
                                title="Editar usuario"
                              >
                                <Edit3 size={16} />
                              </button>
                              {user.id !== currentUser?.id && (
                                <button
                                  onClick={() => deleteUser(user.id)}
                                  className="p-1 text-red-600 hover:text-red-800"
                                  title="Eliminar usuario"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Sección Alertas */}
        {activeSection === "alerts" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Alertas y Notificaciones</h2>
              <button
                onClick={() => {
                  setAlerts((prev) => prev.map((a) => a.userId === currentUser?.id ? { ...a, read: true } : a));
                }}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Marcar todas como leídas
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              {alerts.filter((a) => a.userId === currentUser?.id).length === 0 ? (
                <div className="text-center py-12">
                  <Bell size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No tienes alertas pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts
                    .filter((a) => a.userId === currentUser?.id)
                    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
                    .map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 border rounded-lg ${
                          alert.read ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className={`mt-1 w-2 h-2 rounded-full ${alert.read ? 'bg-gray-400' : 'bg-blue-500'}`} />
                            <div>
                              <p className={`font-medium ${alert.read ? 'text-gray-700' : 'text-gray-900'}`}>
                                {alert.type === "lead_assigned" ? "Nuevo Lead Asignado" : "Cambio en Ranking"}
                              </p>
                              <p className={`text-sm ${alert.read ? 'text-gray-500' : 'text-gray-700'}`}>
                                {alert.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(alert.ts).toLocaleDateString('es-AR')} {new Date(alert.ts).toLocaleTimeString('es-AR')}
                              </p>
                            </div>
                          </div>
                          {!alert.read && (
                            <button
                              onClick={() => {
                                setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, read: true } : a));
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Marcar como leída
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}