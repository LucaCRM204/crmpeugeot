import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Users,
  Trophy,
  Plus,
  Phone,
  BarChart3,
  Settings,
  Home,
  X,
  Trash2,
  Edit3,
  Bell,
  UserCheck,
  ArrowRight,
} from "lucide-react";
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

// ========================= Utils de jerarquía =========================
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

type Role = "owner" | "director" | "gerente" | "supervisor" | "vendedor";

const roles: Record<Role, string> = {
  owner: "Dueño",
  director: "Director",
  gerente: "Gerente",
  supervisor: "Supervisor",
  vendedor: "Vendedor",
};

const estados = {
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
} as const;

type EstadoKey = keyof typeof estados;

const fuentes: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  meta: { label: "Meta/Facebook", color: "bg-blue-600", icon: "📱" },
  whatsapp: { label: "WhatsApp Bot", color: "bg-green-500", icon: "💬" },
  whatsapp_100: { label: "WhatsApp Bot 100", color: "bg-green-700", icon: "💬" },
  whatsapp_bot_cm1: { label: "WhatsApp Bot CM 1", color: "bg-green-600", icon: "💬" },
  whatsapp_bot_cm2: { label: "WhatsApp Bot CM 2", color: "bg-green-600", icon: "💬" },
  sitio_web: { label: "Sitio Web", color: "bg-purple-600", icon: "🌐" },
  referido: { label: "Referido", color: "bg-orange-500", icon: "👥" },
  telefono: { label: "Llamada", color: "bg-indigo-500", icon: "📞" },
  showroom: { label: "Showroom", color: "bg-gray-600", icon: "🏢" },
  google: { label: "Google Ads", color: "bg-red-500", icon: "🎯" },
  instagram: { label: "Instagram", color: "bg-pink-500", icon: "📸" },
  otro: { label: "Otro", color: "bg-gray-400", icon: "❓" },
};

// ============ Config de bots: SIN targetTeam, todos reparten a todos ============
const botConfig: Record<string, { label: string }> = {
  whatsapp_bot_cm1: { label: "Bot CM 1" },
  whatsapp_bot_cm2: { label: "Bot CM 2" },
  whatsapp_100: { label: "Bot 100" },
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
  estado: EstadoKey;
  vendedor: number | null;
  notas?: string;
  fuente: keyof typeof fuentes | string;
  historial?: Array<{
    estado: EstadoKey | string;
    timestamp: string;
    usuario: string;
  }>;
};

type Alert = {
  id: number;
  userId: number;
  type: "lead_assigned" | "ranking_change" | "lead_reassigned";
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
  const [activeSection, setActiveSection] = useState<
    "dashboard" | "leads" | "calendar" | "ranking" | "users" | "alerts" | "team"
  >("dashboard");
  const [loginError, setLoginError] = useState("");
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("todos");

  // -------- Reasignación --------
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigningLead, setReassigningLead] = useState<LeadRow | null>(null);

  // ========================= Login =========================
  const handleLogin = async (email: string, password: string) => {
    try {
      const r = await api.post("/auth/login", { email, password });

      if (r.data?.ok && r.data?.token) {
        // Guardar token y user
        localStorage.setItem("token", r.data.token);
        localStorage.setItem("user", JSON.stringify(r.data.user));

        // FIX Authorization
        api.defaults.headers.common["Authorization"] = `Bearer ${r.data.token}`;

        const u = r.data.user || {
          id: 0,
          name: r.data?.user?.email || email,
          email,
          role: (r.data?.user?.role as Role) || "owner",
          reportsTo: null,
          active: true,
        };

        setCurrentUser(u);
        setIsAuthenticated(true);
        setLoginError("");

        const [uu, ll] = await Promise.all([listUsers(), listLeads()]);

        const mappedLeads: LeadRow[] = (ll || []).map(mapLeadFromApi);
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

  // ========================= Accesos / Scope =========================
  // Alcance: owner = todos; el resto = self + descendientes
  const getAccessibleUserIds = (user: any) => {
    if (!user) return [] as number[];
    if (user.role === "owner") return users.map((u: any) => u.id);
    return [user.id, ...getDescendantUserIds(user.id, childrenIndex)];
  };
  const canManageUsers = () =>
    currentUser && ["owner", "director", "gerente"].includes(currentUser.role);
  const isOwner = () => currentUser?.role === "owner";

  // ¿Puedo tocar este lead? Sólo si el vendedor actual está en mi equipo
  const canReassignLead = (lead: LeadRow) => {
    if (!currentUser || !lead.vendedor) return false;
    const allowed = new Set(getAccessibleUserIds(currentUser));
    return allowed.has(lead.vendedor);
  };

  // ¿A quién puedo reasignar? Sólo vendedores activos dentro de mi equipo
  const getReassignableVendedores = (lead: LeadRow) => {
    if (!currentUser || !lead.vendedor) return [];
    if (!canReassignLead(lead)) return [];
    const allowed = new Set(getAccessibleUserIds(currentUser));
    return users.filter(
      (u: any) =>
        u.role === "vendedor" && u.active && u.id !== lead.vendedor && allowed.has(u.id)
    );
  };

  // ========================= Filtros por equipo =========================
  const getTeamManagerById = (teamId: string) => {
    if (teamId === "todos") return null;
    return users.find((u: any) => u.role === "gerente" && String(u.id) === teamId);
  };

  const getTeamUserIds = (teamId: string) => {
    if (teamId === "todos") return [];
    const manager = getTeamManagerById(teamId);
    if (!manager) return [];
    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return [manager.id, ...descendants];
  };

  const getFilteredLeadsByTeam = (teamId?: string) => {
    if (!currentUser) return [] as LeadRow[];
    if (teamId && teamId !== "todos") {
      const teamUserIds = getTeamUserIds(teamId);
      return leads.filter((l) => (l.vendedor ? teamUserIds.includes(l.vendedor) : false));
    }
    // filtro default = mi scope
    const visibleUserIds = getAccessibleUserIds(currentUser);
    return leads.filter((l) => (l.vendedor ? visibleUserIds.includes(l.vendedor) : true));
  };

  // ========================= Round Robin =========================
  const [rrIndex, setRrIndex] = useState(0);

  const getAllActiveVendorIds = () =>
    users.filter((u: any) => u.role === "vendedor" && u.active).map((u: any) => u.id);

  const getActiveVendorIdsInScope = (scopeUser?: any) => {
    const base = scopeUser || currentUser;
    if (!base) return [] as number[];
    const scope = new Set(getAccessibleUserIds(base));
    return users
      .filter((u: any) => u.role === "vendedor" && u.active && scope.has(u.id))
      .map((u: any) => u.id);
  };

  // Bots: TODOS → todos los vendedores activos (general)
  // Manual: sólo mi equipo
  const pickNextVendorId = (scopeUser?: any, botSource?: string) => {
    let pool: number[] = [];
    if (botSource && botConfig[botSource]) {
      pool = getAllActiveVendorIds();
    } else {
      pool = getActiveVendorIdsInScope(scopeUser || currentUser);
    }
    if (pool.length === 0) return null;
    const id = pool[rrIndex % pool.length];
    setRrIndex((i) => i + 1);
    return id;
  };

  // ========================= Alertas locales =========================
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const nextAlertId = useRef(1);
  const pushAlert = (userId: number, type: Alert["type"], message: string) => {
    setAlerts((prev) => [
      ...prev,
      {
        id: nextAlertId.current++,
        userId,
        type,
        message,
        ts: new Date().toISOString(),
        read: false,
      },
    ]);
  };
  const pushAlertToChain = (vendorId: number, type: Alert["type"], message: string) => {
    pushAlert(vendorId, type, message);
    const sup = users.find((u: any) => u.id === userById.get(vendorId)?.reportsTo);
    if (sup) pushAlert(sup.id, type, message);
    const gerente = sup ? users.find((u: any) => u.id === sup.reportsTo) : null;
    if (gerente) pushAlert(gerente.id, type, message);
  };
  const unreadCount = (uid: number) => alerts.filter((a) => a.userId === uid && !a.read).length;

  // ========================= Leads visibles y ranking =========================
  const visibleUserIds = useMemo(
    () => (currentUser ? getAccessibleUserIds(currentUser) : []),
    [currentUser, users]
  );

  const getFilteredLeads = () => {
    if (!currentUser) return [] as LeadRow[];
    return leads.filter((l) => (l.vendedor ? visibleUserIds.includes(l.vendedor) : true));
  };

  const getVisibleUsers = () => {
    if (!currentUser) return [];
    const ids = new Set(getAccessibleUserIds(currentUser));
    return users.filter((u: any) => ids.has(u.id));
  };

  const getRanking = () => {
    const vendedores = users.filter((u: any) => u.role === "vendedor");
    return vendedores
      .map((v: any) => {
        const ventas = leads.filter((l) => l.vendedor === v.id && l.estado === "vendido").length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        const jef = userById.get(v.reportsTo)?.name || "—";
        return {
          id: v.id,
          nombre: v.name,
          ventas,
          leadsAsignados,
          team: `Equipo de ${jef}`,
        };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  const getRankingInScope = () => {
    const vendedores = users.filter(
      (u: any) => u.role === "vendedor" && visibleUserIds.includes(u.id)
    );
    return vendedores
      .map((v: any) => {
        const ventas = leads.filter((l) => l.vendedor === v.id && l.estado === "vendido").length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        const jef = userById.get(v.reportsTo)?.name || "—";
        return {
          id: v.id,
          nombre: v.name,
          ventas,
          leadsAsignados,
          team: `Equipo de ${jef}`,
        };
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
        const msg =
          delta > 0
            ? `¡Subiste ${Math.abs(delta)} puesto(s) en el ranking!`
            : `Bajaste ${Math.abs(delta)} puesto(s) en el ranking.`;
        pushAlertToChain(vid, "ranking_change", msg);
      }
    });
    prevRankingRef.current = curr;
  }, [leads, users, userById]);

  const getDashboardStats = (teamFilter?: string) => {
    const filteredLeads =
      teamFilter && teamFilter !== "todos"
        ? getFilteredLeadsByTeam(teamFilter)
        : getFilteredLeads();
    const vendidos = filteredLeads.filter((lead) => lead.estado === "vendido").length;
    const conversion =
      filteredLeads.length > 0 ? ((vendidos / filteredLeads.length) * 100).toFixed(1) : "0";
    return { totalLeads: filteredLeads.length, vendidos, conversion };
  };

  const getSourceMetrics = (teamFilter?: string) => {
    const filteredLeads =
      teamFilter && teamFilter !== "todos"
        ? getFilteredLeadsByTeam(teamFilter)
        : getFilteredLeads();
    const sourceData = Object.keys(fuentes)
      .map((source) => {
        const sourceLeads = filteredLeads.filter((lead) => String(lead.fuente) === source);
        const vendidos = sourceLeads.filter((lead) => lead.estado === "vendido").length;
        const conversion =
          sourceLeads.length > 0 ? ((vendidos / sourceLeads.length) * 100).toFixed(1) : "0";
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

  // ========================= Acciones de Leads =========================
  const mapLeadFromApi = (L: any): LeadRow => ({
    id: L.id,
    nombre: L.nombre,
    telefono: L.telefono,
    modelo: L.modelo,
    formaPago: L.formaPago,
    infoUsado: L.infoUsado,
    entrega: L.entrega,
    fecha: L.fecha || L.created_at || "",
    estado: (L.estado || "nuevo") as EstadoKey,
    vendedor: L.assigned_to ?? L.vendedor ?? null,
    notas: L.notas || "",
    fuente: (L.fuente || "otro") as LeadRow["fuente"],
    historial: L.historial || [],
  });

  const addHistorialEntry = (leadId: number, estado: EstadoKey | string) => {
    if (!currentUser) return;
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              historial: [
                ...(lead.historial || []),
                {
                  estado,
                  timestamp: new Date().toISOString(),
                  usuario: currentUser.name,
                },
              ],
            }
          : lead
      )
    );
  };

  const handleUpdateLeadStatus = async (leadId: number, newStatus: EstadoKey) => {
    try {
      const updated = await apiUpdateLead(leadId, { estado: newStatus });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l)));
      addHistorialEntry(leadId, newStatus);
    } catch (e) {
      console.error("No pude actualizar estado del lead", e);
    }
  };

  const handleReassignLead = async (leadId: number, newVendedorId: number) => {
    try {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;

      // Seguridad: destino debe estar permitido por mi equipo
      const allowedIds = new Set(getReassignableVendedores(lead).map((v: any) => v.id));
      if (!allowedIds.has(newVendedorId)) {
        console.warn("No autorizado: el vendedor destino no está en tu equipo.");
        return;
      }

      const updated = await apiUpdateLead(leadId, { assigned_to: newVendedorId });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l)));

      const oldVendedor = userById.get(lead.vendedor || 0);
      const newVendedor = userById.get(newVendedorId);
      if (newVendedor) {
        pushAlert(
          newVendedorId,
          "lead_reassigned",
          `Lead reasignado: ${lead.nombre} (anteriormente de ${oldVendedor?.name || "Sin asignar"})`
        );
        if (newVendedor.reportsTo) {
          pushAlert(
            newVendedor.reportsTo,
            "lead_reassigned",
            `Lead reasignado a ${newVendedor.name}: ${lead.nombre}`
          );
        }
      }

      setShowReassignModal(false);
      setReassigningLead(null);
    } catch (e) {
      console.error("No pude reasignar el lead", e);
    }
  };

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

    // Detectar si es un bot y asignar según nueva regla (general)
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
  vendedor: vendedorId, // <- usar "vendedor" para tipar correcto
});


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

  // ========================= Calendario (UI local) =========================
  const [events, setEvents] = useState<any[]>([]);
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState<number | null>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);

  const visibleUsersList = useMemo(() => (currentUser ? getVisibleUsers() : []), [currentUser, users]);
  const eventsForSelectedUser = useMemo(() => {
    const uid = selectedCalendarUserId || currentUser?.id;
    return events
      .filter((e) => e.userId === uid)
      .sort((a, b) => ((a.date + (a.time || "")) > (b.date + (b.time || "")) ? 1 : -1));
  }, [events, selectedCalendarUserId, currentUser]);

  const formatterEs = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const createEvent = () => {
    const title = (document.getElementById("ev-title") as HTMLInputElement).value;
    const date = (document.getElementById("ev-date") as HTMLInputElement).value;
    const time = (document.getElementById("ev-time") as HTMLInputElement).value;
    const userId = parseInt((document.getElementById("ev-user") as HTMLSelectElement).value, 10);
    if (title && date && userId) {
      setEvents((prev) => [
        ...prev,
        { id: Math.max(0, ...prev.map((e: any) => e.id)) + 1, title, date, time: time || "09:00", userId },
      ]);
      setShowNewEventModal(false);
    }
  };
  const deleteEvent = (id: number) => setEvents((prev) => prev.filter((e: any) => e.id !== id));

  // ========================= Gestión de Usuarios =========================
  const [, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [modalRole, setModalRole] = useState<Role>("vendedor");
  const [modalReportsTo, setModalReportsTo] = useState<number | null>(null);

  const validRolesByUser = (user: any): Role[] => {
    if (!user) return [];
    switch (user.role as Role) {
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

  const validManagersByRole = (role: Role) => {
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
    const roleDefault = (availableRoles?.[0] as Role) || "vendedor";
    const managers = validManagersByRole(roleDefault);
    setModalRole(roleDefault);
    setModalReportsTo(roleDefault === "owner" ? null : managers[0]?.id ?? null);
    setShowUserModal(true);
  };

  const openEditUser = (u: any) => {
    setEditingUser(u);
    const roleCurrent = u.role as Role;
    const availableRoles: Role[] =
      currentUser.role === "owner" && u.id === currentUser.id
        ? (["owner", ...validRolesByUser(currentUser)] as Role[])
        : (validRolesByUser(currentUser) as Role[]);
    const roleToSet = (availableRoles.includes(roleCurrent) ? roleCurrent : availableRoles[0]) as Role;
    const managers = validManagersByRole(roleToSet);
    setModalRole(roleToSet);
    setModalReportsTo(roleToSet === "owner" ? null : u.reportsTo ?? managers[0]?.id ?? null);
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
void saveUser; // evita TS6133 por ahora
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

  // ========================= UI: Login =========================
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
              <input
                type="email"
                id="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="tu@alluma.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <input
                type="password"
                id="password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
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

  // ========================= UI autenticada =========================
  // --------- Modales de Leads ---------
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showObservacionesModal, setShowObservacionesModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [editingLeadObservaciones, setEditingLeadObservaciones] = useState<LeadRow | null>(null);
  const [viewingLeadHistorial, setViewingLeadHistorial] = useState<LeadRow | null>(null);

  // --------- Controles de Leads ---------
  const [leadSearch, setLeadSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("");

  const filteredLeadsForTable = useMemo(() => {
    const base = getFilteredLeads();
    const byEstado = estadoFilter ? base.filter((l) => l.estado === estadoFilter) : base;
    const byQuery = leadSearch
      ? byEstado.filter((l) => {
          const q = leadSearch.toLowerCase();
          return (
            l.nombre?.toLowerCase().includes(q) ||
            l.telefono?.toLowerCase().includes(q) ||
            l.modelo?.toLowerCase().includes(q) ||
            l.notas?.toLowerCase().includes(q)
          );
        })
      : byEstado;
    return byQuery.sort((a, b) => (String(b.fecha).localeCompare(String(a.fecha))));
  }, [leads, currentUser, estadoFilter, leadSearch]);

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
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold text-white">Alluma</h1>
              <p className="text-xs text-gray-400">Publicidad</p>
            </div>
          </div>

          <div className="text-sm text-gray-300">
            <p>{currentUser?.name || currentUser?.email}</p>
            <p className="text-blue-300">{roles[currentUser?.role as Role] || currentUser?.role}</p>
            <p className="text-xs mt-1">🔔 {unreadCount(currentUser?.id || 0)} notificaciones</p>
          </div>
        </div>
        <nav className="space-y-2">
          {[
            { key: "dashboard", label: "Dashboard", Icon: Home },
            { key: "leads", label: "Leads", Icon: Users },
            { key: "calendar", label: "Calendario", Icon: Calendar },
            { key: "ranking", label: "Ranking", Icon: Trophy },
            ...(["supervisor", "gerente", "director", "owner"].includes(currentUser?.role)
              ? [{ key: "team", label: "Mi Equipo", Icon: UserCheck }]
              : []),
            ...(canManageUsers() ? [{ key: "users", label: "Usuarios", Icon: Settings }] : []),
            { key: "alerts", label: "Alertas", Icon: Bell },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as any)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === (key as any)
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-slate-800"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main */}
      <div className="flex-1 p-6 space-y-6">
        {/* ======= DASHBOARD ======= */}
        {activeSection === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
              <div className="flex items-center space-x-3">
                {["owner", "director"].includes(currentUser?.role) && (
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="todos">Todos mis equipos</option>
                    {getVisibleUsers()
                      .filter((u: any) => u.role === "gerente")
                      .map((g: any) => (
                        <option key={g.id} value={g.id}>
                          Equipo {g.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => {
                const stats = getDashboardStats(
                  ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined
                );
                return (
                  <>
                    <div className="bg-white rounded-xl shadow p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Leads</p>
                          <p className="text-2xl font-bold">{stats.totalLeads}</p>
                        </div>
                        <Users />
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Vendidos</p>
                          <p className="text-2xl font-bold text-green-600">{stats.vendidos}</p>
                        </div>
                        <Trophy />
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Conversión</p>
                          <p className="text-2xl font-bold">{stats.conversion}%</p>
                        </div>
                        <BarChart3 />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Fuentes y conversión</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Fuente</th>
                      <th className="px-4 py-2 text-right">Leads</th>
                      <th className="px-4 py-2 text-right">Vendidos</th>
                      <th className="px-4 py-2 text-right">Conversión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getSourceMetrics(
                      ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined
                    ).map((row) => (
                      <tr key={row.source} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <span className="mr-1">{row.icon}</span>
                          <span>{row.label}</span>
                        </td>
                        <td className="px-4 py-2 text-right">{row.total}</td>
                        <td className="px-4 py-2 text-right">{row.vendidos}</td>
                        <td className="px-4 py-2 text-right">{row.conversion.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {getSourceMetrics(
                      ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined
                    ).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                          Sin datos suficientes para mostrar métricas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======= LEADS ======= */}
        {activeSection === "leads" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Leads</h2>
              <button
                onClick={() => setShowNewLeadModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                <span>Nuevo Lead</span>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder="Buscar por cliente, teléfono, modelo o notas…"
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <select
                  value={estadoFilter}
                  onChange={(e) => setEstadoFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Todos los estados</option>
                  {Object.keys(estados).map((k) => (
                    <option key={k} value={k}>
                      {estados[k as EstadoKey].label}
                    </option>
                  ))}
                </select>
                {["owner", "director"].includes(currentUser?.role) && (
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="todos">Todos mis equipos</option>
                    {getVisibleUsers()
                      .filter((u: any) => u.role === "gerente")
                      .map((g: any) => (
                        <option key={g.id} value={g.id}>
                          Equipo {g.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Contacto</th>
                      <th className="px-3 py-2 text-left">Vehículo</th>
                      <th className="px-3 py-2 text-left">Fuente</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-left">Vendedor</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredLeadsForTable
                      .filter((l) =>
                        ["owner", "director"].includes(currentUser?.role) && selectedTeam !== "todos"
                          ? getTeamUserIds(selectedTeam).includes(l.vendedor || -1)
                          : true
                      )
                      .map((lead) => {
                        const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                        return (
                          <tr key={lead.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900">{lead.nombre}</div>
                              {lead.notas && (
                                <div className="text-xs text-gray-500 line-clamp-1">{lead.notas}</div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center space-x-1">
                                <Phone size={12} className="text-gray-400" />
                                <span className="text-gray-700">{lead.telefono}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900">{lead.modelo}</div>
                              <div className="text-xs text-gray-500">{lead.formaPago}</div>
                              {lead.infoUsado && (
                                <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center space-x-1">
                                <span className="text-sm">
                                  {fuentes[lead.fuente as string]?.icon || "❓"}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {fuentes[lead.fuente as string]?.label || String(lead.fuente)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={lead.estado}
                                onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as EstadoKey)}
                                className={`px-2 py-1 rounded text-white text-xs ${
                                  estados[lead.estado]?.color || "bg-gray-500"
                                }`}
                              >
                                {Object.keys(estados).map((k) => (
                                  <option key={k} value={k} className="text-black">
                                    {estados[k as EstadoKey].label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-gray-700">{vendedor?.name || "Sin asignar"}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">
                              {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingLeadObservaciones(lead);
                                    setShowObservacionesModal(true);
                                  }}
                                  className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  title="Ver/Editar observaciones"
                                >
                                  {lead.notas && lead.notas.length > 0 ? "Ver" : "Obs"}
                                </button>
                                <button
                                  onClick={() => {
                                    setViewingLeadHistorial(lead);
                                    setShowHistorialModal(true);
                                  }}
                                  className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  title="Ver historial"
                                >
                                  Hist
                                </button>
                                {canReassignLead(lead) && (
                                  <button
                                    onClick={() => {
                                      setReassigningLead(lead);
                                      setShowReassignModal(true);
                                    }}
                                    className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                                    title="Reasignar lead"
                                  >
                                    Reasig
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    if (!window.confirm("¿Eliminar este lead?")) return;
                                    try {
                                      await apiDeleteLead(lead.id);
                                      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
                                    } catch (e) {
                                      console.error("No pude eliminar lead", e);
                                    }
                                  }}
                                  className="p-1 text-red-600 hover:text-red-800"
                                  title="Eliminar lead"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {filteredLeadsForTable.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                          No hay leads para mostrar
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======= CALENDARIO ======= */}
        {activeSection === "calendar" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Calendario</h2>
              <div className="flex items-center space-x-3">
                <select
                  value={selectedCalendarUserId ?? ""}
                  onChange={(e) =>
                    setSelectedCalendarUserId(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Mi calendario</option>
                  {visibleUsersList
                    .filter((u: any) => u.id !== currentUser?.id)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {roles[u.role as Role] || u.role}
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
                Próximos eventos — {selectedCalendarUserId ? userById.get(selectedCalendarUserId)?.name : "Mi calendario"}
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

        {/* ======= RANKING ======= */}
        {activeSection === "ranking" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Ranking de Vendedores</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isOwner() && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Ranking General</h3>
                  <div className="space-y-3">
                    {getRanking().map((vendedor, index) => (
                      <div
                        key={vendedor.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                              index === 0
                                ? "bg-yellow-500"
                                : index === 1
                                ? "bg-gray-400"
                                : index === 2
                                ? "bg-orange-600"
                                : "bg-gray-300"
                            }`}
                          >
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
                    {getRanking().length === 0 && (
                      <p className="text-gray-500 text-center py-8">No hay vendedores registrados</p>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  {isOwner() ? "Mi Scope" : "Ranking"}
                </h3>
                <div className="space-y-3">
                  {getRankingInScope().map((vendedor, index) => (
                    <div
                      key={vendedor.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                            index === 0
                              ? "bg-yellow-500"
                              : index === 1
                              ? "bg-gray-400"
                              : index === 2
                              ? "bg-orange-600"
                              : "bg-gray-300"
                          }`}
                        >
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
                          {vendedor.leadsAsignados} leads •{" "}
                          {vendedor.leadsAsignados > 0
                            ? ((vendedor.ventas / vendedor.leadsAsignados) * 100).toFixed(0)
                            : 0}
                          %
                        </p>
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

        {/* ======= MI EQUIPO ======= */}
        {activeSection === "team" &&
          ["supervisor", "gerente", "director", "owner"].includes(currentUser?.role) && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-800">Mi Equipo</h2>
                {["owner", "director"].includes(currentUser?.role) && (
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="todos">Todos mis equipos</option>
                    {getVisibleUsers()
                      .filter((u: any) => u.role === "gerente")
                      .map((gerente: any) => (
                        <option key={gerente.id} value={gerente.id}>
                          Equipo {gerente.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Estados de Leads — Mi Equipo
                  </h3>
                  {selectedEstado && (
                    <button
                      onClick={() => setSelectedEstado(null)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <X size={16} />
                      <span>Quitar filtro</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(estados).map(([key, estado]) => {
                    const teamFilter =
                      ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined;
                    const filteredLeads =
                      teamFilter && teamFilter !== "todos"
                        ? getFilteredLeadsByTeam(teamFilter)
                        : getFilteredLeads();
                    const count = filteredLeads.filter((l) => l.estado === (key as EstadoKey)).length;
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

                {selectedEstado && (
                  <div className="mt-6 border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">
                      Leads de mi equipo en estado:{" "}
                      <span
                        className={`px-3 py-1 rounded-full text-white text-sm ${estados[selectedEstado as EstadoKey].color}`}
                      >
                        {estados[selectedEstado as EstadoKey].label}
                      </span>
                    </h4>

                    {(() => {
                      const teamFilter =
                        ["owner", "director"].includes(currentUser?.role) ? selectedTeam : undefined;
                      const filteredLeads =
                        teamFilter && teamFilter !== "todos"
                          ? getFilteredLeadsByTeam(teamFilter)
                          : getFilteredLeads();
                      const leadsFiltrados = filteredLeads.filter(
                        (l) => l.estado === (selectedEstado as EstadoKey)
                      );

                      if (leadsFiltrados.length === 0) {
                        return (
                          <p className="text-gray-500 text-center py-8">
                            No hay leads de tu equipo en estado "
                            {estados[selectedEstado as EstadoKey].label}"
                          </p>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Cliente
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Contacto
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Vehículo
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Fuente
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Vendedor
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Fecha
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                                  Acciones
                                </th>
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
                                        {lead.infoUsado && (
                                          <div className="text-xs text-orange-600">
                                            Usado: {lead.infoUsado}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center space-x-1">
                                        <span className="text-sm">
                                          {fuentes[lead.fuente as string]?.icon || "❓"}
                                        </span>
                                        <span className="text-xs text-gray-600">
                                          {fuentes[lead.fuente as string]?.label ||
                                            String(lead.fuente)}
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
                                          onClick={() => {
                                            setEditingLeadObservaciones(lead);
                                            setShowObservacionesModal(true);
                                          }}
                                          className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                          title="Ver/Editar observaciones"
                                        >
                                          {lead.notas && lead.notas.length > 0 ? "Ver" : "Obs"}
                                        </button>
                                        {canReassignLead(lead) && (
                                          <button
                                            onClick={() => {
                                              setReassigningLead(lead);
                                              setShowReassignModal(true);
                                            }}
                                            className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                                            title="Reasignar lead"
                                          >
                                            Reasig
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
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Top vendedores en mi organización */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Top Vendedores en Mi Organización
                </h3>
                <div className="space-y-3">
                  {getRankingInScope().map((vendedor, index) => (
                    <div
                      key={vendedor.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                            index === 0
                              ? "bg-yellow-500"
                              : index === 1
                              ? "bg-gray-400"
                              : index === 2
                              ? "bg-orange-600"
                              : "bg-gray-300"
                          }`}
                        >
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
                          {vendedor.leadsAsignados} leads •{" "}
                          {vendedor.leadsAsignados > 0
                            ? ((vendedor.ventas / vendedor.leadsAsignados) * 100).toFixed(0)
                            : 0}
                          %
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {getRankingInScope().length === 0 && (
                  <p className="text-gray-500 text-center py-8">No hay vendedores en tu equipo</p>
                )}
              </div>
            </div>
          )}

        {/* ======= USUARIOS ======= */}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Usuario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Rol
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Reporta a
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Performance
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
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
                              {roles[user.role as Role] || user.role}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">{manager?.name || "—"}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  user.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                }`}
                              >
                                {user.active ? "Activo" : "Inactivo"}
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
                                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                                      : "bg-green-100 text-green-700 hover:bg-green-200"
                                  }`}
                                  title={user.active ? "Desactivar vendedor" : "Activar vendedor"}
                                >
                                  {user.active ? "Desactivar" : "Activar"}
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
                    {getVisibleUsers().length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                          No hay usuarios en tu equipo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======= ALERTAS ======= */}
        {activeSection === "alerts" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Alertas y Notificaciones</h2>
              <button
                onClick={() => {
                  setAlerts((prev) =>
                    prev.map((a) => (a.userId === currentUser?.id ? { ...a, read: true } : a))
                  );
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
                          alert.read ? "border-gray-200 bg-gray-50" : "border-blue-200 bg-blue-50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div
                              className={`mt-1 w-2 h-2 rounded-full ${
                                alert.read ? "bg-gray-400" : "bg-blue-500"
                              }`}
                            />
                            <div>
                              <p
                                className={`font-medium ${
                                  alert.read ? "text-gray-700" : "text-gray-900"
                                }`}
                              >
                                {alert.type === "lead_assigned"
                                  ? "Nuevo Lead Asignado"
                                  : alert.type === "lead_reassigned"
                                  ? "Lead Reasignado"
                                  : "Cambio en Ranking"}
                              </p>
                              <p
                                className={`text-sm ${
                                  alert.read ? "text-gray-500" : "text-gray-700"
                                }`}
                              >
                                {alert.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(alert.ts).toLocaleDateString("es-AR")}{" "}
                                {new Date(alert.ts).toLocaleTimeString("es-AR")}
                              </p>
                            </div>
                          </div>
                          {!alert.read && (
                            <button
                              onClick={() => {
                                setAlerts((prev) =>
                                  prev.map((a) => (a.id === alert.id ? { ...a, read: true } : a))
                                );
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

      {/* ====== MODAL: Reasignar Lead ====== */}
      {showReassignModal && reassigningLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800">
                Reasignar Lead — {reassigningLead.nombre}
              </h3>
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setReassigningLead(null);
                }}
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Cliente:</span>
                    <p className="text-gray-900">{reassigningLead.nombre}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Teléfono:</span>
                    <p className="text-gray-900">{reassigningLead.telefono}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Vehículo:</span>
                    <p className="text-gray-900">{reassigningLead.modelo}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Estado actual:</span>
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white ${estados[reassigningLead.estado].color}`}
                    >
                      {estados[reassigningLead.estado].label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Vendedor actual:</span>
                    <p className="text-blue-900 font-medium">
                      {userById.get(reassigningLead.vendedor!)?.name || "Sin asignar"}
                    </p>
                  </div>
                  <ArrowRight className="text-blue-500" size={20} />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Nuevo vendedor:</span>
                    <select
                      id="reassign-vendedor"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      defaultValue=""
                    >
                      <option value="">Seleccionar vendedor…</option>
                      {getReassignableVendedores(reassigningLead).map((vendedor: any) => (
                        <option key={vendedor.id} value={vendedor.id}>
                          {vendedor.name} — {userById.get(vendedor.reportsTo)?.name || "Sin supervisor"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {getReassignableVendedores(reassigningLead).length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-yellow-800 text-sm">
                    No hay vendedores disponibles para reasignación en tu equipo.
                  </p>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  const selectElement = document.getElementById("reassign-vendedor") as HTMLSelectElement;
                  const newVendedorId = parseInt(selectElement.value);
                  if (newVendedorId) {
                    handleReassignLead(reassigningLead.id, newVendedorId);
                  }
                }}
                disabled={getReassignableVendedores(reassigningLead).length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Reasignar Lead
              </button>
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setReassigningLead(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL: Observaciones ====== */}
      {showObservacionesModal && editingLeadObservaciones && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800">
                Observaciones — {editingLeadObservaciones.nombre}
              </h3>
              <button
                onClick={() => {
                  setShowObservacionesModal(false);
                  setEditingLeadObservaciones(null);
                }}
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Cliente:</span> {editingLeadObservaciones.nombre}{" "}
                <span className="font-medium ml-2">Teléfono:</span> {editingLeadObservaciones.telefono}{" "}
                <span className="font-medium ml-2">Vehículo:</span> {editingLeadObservaciones.modelo}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Estado actual:</span>{" "}
                <span
                  className={`ml-2 px-2 py-1 rounded-full text-xs font-medium text-white ${estados[editingLeadObservaciones.estado].color}`}
                >
                  {estados[editingLeadObservaciones.estado].label}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
              <textarea
                id="observaciones-textarea"
                defaultValue={editingLeadObservaciones.notas || ""}
                placeholder="Agregar observaciones sobre el cliente, llamadas realizadas, intereses, objeciones, etc…"
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

      {/* ====== MODAL: Historial ====== */}
      {showHistorialModal && viewingLeadHistorial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800">
                Historial — {viewingLeadHistorial.nombre}
              </h3>
              <button
                onClick={() => {
                  setShowHistorialModal(false);
                  setViewingLeadHistorial(null);
                }}
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Cliente:</span> {viewingLeadHistorial.nombre}{" "}
                <span className="font-medium ml-2">Teléfono:</span> {viewingLeadHistorial.telefono}{" "}
                <span className="font-medium ml-2">Vehículo:</span> {viewingLeadHistorial.modelo}
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {(viewingLeadHistorial.historial || []).length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No hay historial disponible para este lead
                </p>
              ) : (
                <div className="space-y-3">
                  {viewingLeadHistorial.historial?.map((entry, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium text-white ${
                            estados[entry.estado as EstadoKey]?.color || "bg-gray-500"
                          }`}
                        >
                          {estados[entry.estado as EstadoKey]?.label || entry.estado}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleDateString("es-AR")}{" "}
                          {new Date(entry.timestamp).toLocaleTimeString("es-AR")}
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

      {/* ====== MODAL: Nuevo Lead ====== */}
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
                  {/* (Las opciones de bot ya están en 'fuentes') */}
                </select>
                <div className="mt-2 text-xs space-y-1">
                  <div className="text-green-600">
                    💬 Todos los bots → Distribución general a todos los vendedores activos
                  </div>
                  <div className="text-gray-500">Otras fuentes → Asignación manual o según tu scope</div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Info Usado</label>
                <input
                  type="text"
                  id="new-infoUsado"
                  placeholder="Marca Modelo Año"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
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
                <span className="text-sm text-gray-700">Asignación automática y equitativa</span>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asignar a vendedor (opcional)
                </label>
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
                <p className="text-xs text-gray-500 mt-1">
                  Si está tildado "Asignación automática", se ignorará esta selección.
                </p>
              </div>
            </div>
            <div className="flex space-x-3 pt-6">
              <button
                onClick={() => setShowNewLeadModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateLead}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL: Nuevo Evento ====== */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
                <select id="ev-user" className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value={currentUser.id}>{currentUser.name} (yo)</option>
                  {visibleUsersList
                    .filter((u: any) => u.id !== currentUser.id)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {roles[u.role as Role] || u.role}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex space-x-3 pt-6">
              <button
                onClick={() => setShowNewEventModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={createEvent}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear evento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
