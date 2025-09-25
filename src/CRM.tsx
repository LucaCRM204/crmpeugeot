// CRM.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Download,
  Search,
  Filter,
  User,
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

function getDescendantUserIds(
  rootId: number,
  childrenIndex: Map<number, number[]>
) {
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

const fuentes: Record<
  string,
  { label: string; color: string; icon: string }
> = {
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

// Configuración de bots (si aplica en tu backend)
const botConfig: Record<string, { targetTeam: string | null; label: string }> =
  {
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
  fuente: keyof typeof fuentes | string; // puede venir "creado_por:<id>"
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

// ===== Helpers para mostrar fuente =====
function fuenteToLabel(f: string, userById: Map<number, any>) {
  if (typeof f === "string" && f.startsWith("creado_por:")) {
    const idStr = f.split(":")[1];
    const uid = parseInt(idStr, 10);
    const u = userById.get(uid);
    return { icon: "✍️", label: `Creado por ${u?.name || "Usuario"}` };
  }
  const found = (fuentes as any)[f] || null;
  if (found) return { icon: found.icon, label: found.label };
  return { icon: "❓", label: String(f) };
}

// ===== Funciones de descarga Excel =====
const formatDate = (dateString: string): string => {
  if (!dateString) return "Sin fecha";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-AR");
};

const escapeCSV = (val: any) =>
  `"${String(val ?? "").replace(/"/g, '""')}"`;

const downloadAllLeadsExcel = (
  leads: LeadRow[],
  userById: Map<number, any>
): void => {
  const excelData = leads.map((lead) => {
    const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
    const { label: fuenteLabel } = fuenteToLabel(lead.fuente as string, userById);
    return {
      ID: lead.id,
      Cliente: lead.nombre,
      Teléfono: lead.telefono,
      Modelo: lead.modelo,
      "Forma de Pago": lead.formaPago || "",
      "Info Usado": lead.infoUsado || "",
      Entrega: lead.entrega ? "Sí" : "No",
      Estado: estados[lead.estado]?.label || lead.estado,
      Fuente: fuenteLabel,
      Vendedor: vendedor?.name || "Sin asignar",
      Equipo:
        vendedor && vendedor.reportsTo
          ? `Equipo de ${userById.get(vendedor.reportsTo)?.name || "—"}`
          : "",
      Fecha: formatDate(lead.fecha || ""),
      Observaciones: lead.notas || "",
    };
  });

  const headers = Object.keys(excelData[0] || {});
  const csvContent = [
    headers.join(","),
    ...excelData.map((row) => headers.map((h) => escapeCSV((row as any)[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `todos_los_leads_${new Date().toISOString().slice(0, 10)}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadLeadsByStateExcel = (
  leads: LeadRow[],
  estado: string,
  userById: Map<number, any>
): void => {
  const leadsByState = leads.filter((l) => l.estado === estado);
  if (leadsByState.length === 0) {
    alert(`No hay leads en estado "${estados[estado]?.label || estado}"`);
    return;
  }

  const excelData = leadsByState.map((lead) => {
    const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
    const { label: fuenteLabel } = fuenteToLabel(lead.fuente as string, userById);
    return {
      ID: lead.id,
      Cliente: lead.nombre,
      Teléfono: lead.telefono,
      Modelo: lead.modelo,
      "Forma de Pago": lead.formaPago || "",
      "Info Usado": lead.infoUsado || "",
      Entrega: lead.entrega ? "Sí" : "No",
      Fuente: fuenteLabel,
      Vendedor: vendedor?.name || "Sin asignar",
      Equipo:
        vendedor && vendedor.reportsTo
          ? `Equipo de ${userById.get(vendedor.reportsTo)?.name || "—"}`
          : "",
      Fecha: formatDate(lead.fecha || ""),
      Observaciones: lead.notas || "",
      Historial:
        lead.historial
          ?.map((h) => `${formatDate(h.timestamp)}: ${h.estado} (${h.usuario})`)
          .join(" | ") || "",
    };
  });

  const headers = Object.keys(excelData[0] || {});
  const csvContent = [
    headers.join(","),
    ...excelData.map((row) => headers.map((h) => escapeCSV((row as any)[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  const estadoLabel = estados[estado]?.label || estado;
  link.setAttribute(
    "download",
    `leads_${estadoLabel.toLowerCase().replace(/\s+/g, "_")}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function CRM() {
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const { byId: userById, children: childrenIndex } = useMemo(
    () => buildIndex(users),
    [users]
  );

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "dashboard" | "leads" | "calendar" | "ranking" | "users" | "alerts" | "team"
  >("dashboard");
  const [loginError, setLoginError] = useState("");
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("todos");

  // Búsqueda y filtros en Leads
  const [searchText, setSearchText] = useState("");
  const [selectedVendedorFilter, setSelectedVendedorFilter] = useState<number | null>(null);
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState<string>("");
  const [selectedFuenteFilter, setSelectedFuenteFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Reasignación
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [leadToReassign, setLeadToReassign] = useState<LeadRow | null>(null);
  const [selectedVendorForReassign, setSelectedVendorForReassign] =
    useState<number | null>(null);

  // Confirmación eliminación de usuario
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  // ===== Login =====
  const handleLogin = async (email: string, password: string) => {
    try {
      const r = await api.post("/auth/login", {
        email,
        password,
        allowInactiveUsers: true,
      });

      if (r.data?.ok && r.data?.token) {
        localStorage.setItem("token", r.data.token);
        localStorage.setItem("user", JSON.stringify(r.data.user));
        api.defaults.headers.common["Authorization"] = `Bearer ${r.data.token}`;

        const u =
          r.data.user || {
            id: 0,
            name: r.data?.user?.email || email,
            email,
            role: r.data?.user?.role || "owner",
            reportsTo: null,
            active: r.data?.user?.active ?? true,
          };

        setCurrentUser(u);
        setIsAuthenticated(true);
        setLoginError("");

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
          vendedor: L.assigned_to ?? L.vendedor ?? null,
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
    if (["owner", "director"].includes(user.role))
      return users.map((u: any) => u.id);
    const ids = [user.id, ...getDescendantUserIds(user.id, childrenIndex)];
    return ids;
  };
  const canManageUsers = () =>
    currentUser && ["owner", "director", "gerente"].includes(currentUser.role);
  const isOwner = () => currentUser?.role === "owner";
  const canCreateLeads =
    currentUser && ["vendedor", "supervisor", "gerente"].includes(currentUser.role);

  // ===== Filtro por equipo =====
  const getTeamManagerById = (teamId: string) => {
    if (teamId === "todos") return null;
    return users.find((u: any) => u.role === "gerente" && u.id.toString() === teamId);
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
    if (
      teamId &&
      teamId !== "todos" &&
      ["owner", "director"].includes(currentUser.role)
    ) {
      const teamUserIds = getTeamUserIds(teamId);
      return leads.filter((l) =>
        l.vendedor ? teamUserIds.includes(l.vendedor) : false
      );
    }
    const visibleUserIds = getAccessibleUserIds(currentUser);
    return leads.filter((l) =>
      l.vendedor ? visibleUserIds.includes(l.vendedor) : true
    );
  };

  // ===== Usuarios visibles según rol =====
  const getVisibleUsers = () => {
    if (!currentUser) return [];

    return users.filter((u: any) => {
      if (currentUser.role === "owner") return true;
      if (currentUser.role === "director") return u.role !== "owner";
      if (currentUser.role === "gerente") {
        if (u.id === currentUser.id) return true;
        if (u.reportsTo === currentUser.id) return true; // supervisores
        const userSupervisor = userById.get(u.reportsTo);
        return userSupervisor && userSupervisor.reportsTo === currentUser.id; // vendedores bajo supervisores
      }
      if (currentUser.role === "supervisor") {
        if (u.id === currentUser.id) return true;
        return u.reportsTo === currentUser.id; // vendedores directos
      }
      if (currentUser.role === "vendedor") {
        return u.id === currentUser.id; // sólo el mismo vendedor
      }
      return false;
    });
  };

  // ===== Leads filtrados + búsqueda =====
  const getFilteredAndSearchedLeads = () => {
    if (!currentUser) return [] as LeadRow[];

    const visibleUserIds = getAccessibleUserIds(currentUser);
    let filteredLeads = leads.filter((l) =>
      l.vendedor ? visibleUserIds.includes(l.vendedor) : true
    );

    if (selectedVendedorFilter !== null) {
      if (selectedVendedorFilter === 0) {
        filteredLeads = filteredLeads.filter((l) => l.vendedor === null);
      } else {
        filteredLeads = filteredLeads.filter((l) => l.vendedor === selectedVendedorFilter);
      }
    }

    if (selectedEstadoFilter) {
      filteredLeads = filteredLeads.filter((l) => l.estado === selectedEstadoFilter);
    }

    if (selectedFuenteFilter) {
      filteredLeads = filteredLeads.filter((l) => l.fuente === selectedFuenteFilter);
    }

    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filteredLeads = filteredLeads.filter((l) => {
        const vendedor = l.vendedor ? userById.get(l.vendedor) : null;
        return (
          l.nombre.toLowerCase().includes(searchLower) ||
          l.telefono.includes(searchText.trim()) ||
          l.modelo.toLowerCase().includes(searchLower) ||
          (l.notas && l.notas.toLowerCase().includes(searchLower)) ||
          (vendedor && vendedor.name.toLowerCase().includes(searchLower)) ||
          (l.formaPago && l.formaPago.toLowerCase().includes(searchLower)) ||
          (l.infoUsado && l.infoUsado.toLowerCase().includes(searchLower))
        );
      });
    }

    return filteredLeads;
  };

  const clearFilters = () => {
    setSearchText("");
    setSelectedVendedorFilter(null);
    setSelectedEstadoFilter("");
    setSelectedFuenteFilter("");
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchText.trim()) count++;
    if (selectedVendedorFilter !== null) count++;
    if (selectedEstadoFilter) count++;
    if (selectedFuenteFilter) count++;
    return count;
  };

  // ===== Vendedores disponibles (sólo activos) =====
  const getAvailableVendorsForReassign = () => {
    if (!currentUser) return [];
    const visible = getVisibleUsers();
    return visible.filter((u: any) => u.role === "vendedor" && u.active);
  };

  // ===== Modal de reasignación =====
  const openReassignModal = (lead: LeadRow) => {
    setLeadToReassign(lead);
    setSelectedVendorForReassign(lead.vendedor);
    setShowReassignModal(true);
  };

  const handleReassignLead = async () => {
    if (!leadToReassign) return;
    try {
      const payload = { vendedor: selectedVendorForReassign } as any;
      const updated = await apiUpdateLead(leadToReassign.id, payload);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadToReassign.id ? { ...l, ...mapLeadFromApi(updated) } : l
        )
      );

      if (selectedVendorForReassign) {
        const nv = userById.get(selectedVendorForReassign);
        pushAlert(
          selectedVendorForReassign,
          "lead_assigned",
          `Lead reasignado: ${leadToReassign.nombre} - ${leadToReassign.modelo}`
        );
        addHistorialEntry(
          leadToReassign.id,
          `Reasignado a ${nv?.name || "Sin asignar"}`
        );
      } else {
        addHistorialEntry(leadToReassign.id, "Reasignado a Sin asignar");
      }

      setShowReassignModal(false);
      setLeadToReassign(null);
      setSelectedVendorForReassign(null);
    } catch (e) {
      console.error("No pude reasignar el lead", e);
    }
  };

  // ===== Round-robin (sólo vendedores activos) =====
  const [rrIndex, setRrIndex] = useState(0);

  const getActiveVendorIdsInScope = (scopeUser?: any) => {
    if (!scopeUser) return [] as number[];
    const scope = getAccessibleUserIds(scopeUser);
    return users
      .filter((u: any) => u.role === "vendedor" && u.active && scope.includes(u.id))
      .map((u: any) => u.id);
  };

  const getVendorsByTeam = (teamName: string) => {
    const manager = users.find(
      (u: any) =>
        u.role === "gerente" &&
        u.name.toLowerCase().includes(teamName.toLowerCase())
    );
    if (!manager) return [];
    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return users
      .filter((u: any) => u.role === "vendedor" && u.active && descendants.includes(u.id))
      .map((u: any) => u.id);
  };

  const pickNextVendorId = (scopeUser?: any, botSource?: string) => {
    let pool: number[] = [];
    if (botSource && botConfig[botSource]) {
      const botConf = botConfig[botSource];
      pool = botConf.targetTeam
        ? getVendorsByTeam(botConf.targetTeam)
        : getActiveVendorIdsInScope(scopeUser || currentUser);
    } else {
      pool = getActiveVendorIdsInScope(scopeUser || currentUser);
    }
    if (pool.length === 0) return null;
    const id = pool[rrIndex % pool.length];
    setRrIndex((i) => i + 1);
    return id;
  };

  // ===== Alertas =====
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

  // ===== Ranking =====
  const visibleUserIds = useMemo(
    () => getAccessibleUserIds(currentUser),
    [currentUser, users]
  );

  const getFilteredLeads = () => {
    if (!currentUser) return [] as LeadRow[];
    return leads.filter((l) =>
      l.vendedor ? visibleUserIds.includes(l.vendedor) : true
    );
  };

  const getRanking = () => {
    const vendedores = users.filter((u: any) => u.role === "vendedor");
    return vendedores
      .map((v: any) => {
        const ventas = leads.filter(
          (l) => l.vendedor === v.id && l.estado === "vendido"
        ).length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return {
          id: v.id,
          nombre: v.name,
          ventas,
          leadsAsignados,
          team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}`,
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
        const ventas = leads.filter(
          (l) => l.vendedor === v.id && l.estado === "vendido"
        ).length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return {
          id: v.id,
          nombre: v.name,
          ventas,
          leadsAsignados,
          team: `Equipo de ${userById.get(v.reportsTo)?.name || "—"}`,
        };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  const getRankingByManagerialTeam = () => {
    if (!currentUser) return [];
    if (currentUser.role === "vendedor") {
      const supervisor = userById.get(currentUser.reportsTo);
      if (!supervisor) return getRankingInScope();
      const gerente = userById.get(supervisor.reportsTo);
      if (!gerente) return getRankingInScope();

      const teamUserIds = getDescendantUserIds(gerente.id, childrenIndex);
      const vendedores = users.filter(
        (u: any) => u.role === "vendedor" && teamUserIds.includes(u.id)
      );
      return vendedores
        .map((v: any) => {
          const ventas = leads.filter(
            (l) => l.vendedor === v.id && l.estado === "vendido"
          ).length;
          const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
          return {
            id: v.id,
            nombre: v.name,
            ventas,
            leadsAsignados,
            team: `Equipo de ${gerente.name}`,
          };
        })
        .sort((a, b) => b.ventas - a.ventas);
    }
    return getRankingInScope();
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

  // ===== Dashboard métricas =====
  const getDashboardStats = (teamFilter?: string) => {
    const filteredLeads =
      teamFilter && teamFilter !== "todos"
        ? getFilteredLeadsByTeam(teamFilter)
        : getFilteredLeads();
    const vendidos = filteredLeads.filter((lead) => lead.estado === "vendido").length;
    const conversion =
      filteredLeads.length > 0
        ? ((vendidos / filteredLeads.length) * 100).toFixed(1)
        : "0";
    return { totalLeads: filteredLeads.length, vendidos, conversion };
  };

  const getSourceMetrics = (teamFilter?: string) => {
    const filteredLeads =
      teamFilter && teamFilter !== "todos"
        ? getFilteredLeadsByTeam(teamFilter)
        : getFilteredLeads();
    const sourceData = Object.keys(fuentes)
      .map((source) => {
        const sourceLeads = filteredLeads.filter((lead) => lead.fuente === source);
        const vendidos = sourceLeads.filter((lead) => lead.estado === "vendido").length;
        const conversion =
          sourceLeads.length > 0
            ? ((vendidos / sourceLeads.length) * 100).toFixed(1)
            : "0";
        return {
          source,
          total: sourceLeads.length,
          vendidos,
          conversion: parseFloat(conversion),
          ...(fuentes as any)[source],
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    return sourceData;
  };

  // ===== Mapeo Lead API =====
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
    vendedor: L.assigned_to ?? L.vendedor ?? null,
    notas: L.notas || "",
    fuente: (L.fuente || "otro") as LeadRow["fuente"],
    historial: L.historial || [],
  });

  const addHistorialEntry = (leadId: number, estado: string) => {
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

  const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { estado: newStatus } as any);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l))
      );
      addHistorialEntry(leadId, newStatus);
    } catch (e) {
      console.error("No pude actualizar estado del lead", e);
    }
  };

  // ===== Calendario (local) =====
  const [events, setEvents] = useState<any[]>([]);
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState<number | null>(null);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const visibleUsers = useMemo(() => (currentUser ? getVisibleUsers() : []), [currentUser, users]);
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
        {
          id: Math.max(0, ...prev.map((e: any) => e.id)) + 1,
          title,
          date,
          time: time || "09:00",
          userId,
        },
      ]);
      setShowNewEventModal(false);
    }
  };
  const deleteEvent = (id: number) =>
    setEvents((prev) => prev.filter((e: any) => e.id !== id));

  // ===== Gestión de Usuarios =====
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [modalRole, setModalRole] = useState<
    "owner" | "director" | "gerente" | "supervisor" | "vendedor"
  >("vendedor");
  const [modalReportsTo, setModalReportsTo] = useState<number | null>(null);
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");

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
    setPassword1("");
    setPassword2("");
    setShowUserModal(true);
  };

  const openEditUser = (u: any) => {
    setEditingUser(u);
    const roleCurrent = u.role as typeof modalRole;
    const availableRoles: string[] =
      currentUser.role === "owner" && u.id === currentUser.id
        ? ["owner", ...validRolesByUser(currentUser)]
        : validRolesByUser(currentUser);
    const roleToSet = availableRoles.includes(roleCurrent)
      ? roleCurrent
      : (availableRoles[0] as any);
    const validManagers = validManagersByRole(roleToSet);
    setModalRole(roleToSet as any);
    setModalReportsTo(
      roleToSet === "owner" ? null : u.reportsTo ?? validManagers[0]?.id ?? null
    );
    setPassword1("");
    setPassword2("");
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (!["owner", "director", "gerente"].includes(currentUser?.role)) {
      alert("No tenés permisos para crear/editar usuarios.");
      return;
    }

    const name = (document.getElementById("u-name") as HTMLInputElement).value.trim();
    const email = (document.getElementById("u-email") as HTMLInputElement).value.trim();
    const active = (document.getElementById("u-active") as HTMLInputElement).checked;

    if (!name || !email) {
      alert("Nombre y email son obligatorios.");
      return;
    }

    const finalReportsTo = modalRole === "owner" ? null : modalReportsTo ?? null;

    // Validaciones de contraseña
    if (!editingUser) {
      if (!password1) {
        alert("La contraseña es obligatoria para crear un usuario.");
        return;
      }
      if (password1 !== password2) {
        alert("Las contraseñas no coinciden.");
        return;
      }
    } else {
      if (password1 || password2) {
        if (password1 !== password2) {
          alert("Las contraseñas no coinciden.");
          return;
        }
      }
    }

    try {
      if (editingUser) {
        const payload: any = {
          name,
          email,
          role: modalRole,
          reportsTo: finalReportsTo,
          active: active ? 1 : 0,
        };
        if (password1) payload.password = password1; // actualizar sólo si se ingresó

        const updated = await apiUpdateUser(editingUser.id, payload);
        setUsers((prev) => prev.map((u: any) => (u.id === editingUser.id ? updated : u)));
      } else {
        // CREACIÓN: enviar exactamente la password que escribió el usuario
        const created = await apiCreateUser({
          name,
          email,
          password: password1,
          role: modalRole,
          reportsTo: finalReportsTo,
          active: active ? 1 : 0,
        } as any);
        setUsers((prev) => [...prev, created]);
      }
      setShowUserModal(false);
    } catch (e) {
      console.error("No pude guardar usuario", e);
      alert("Error al guardar el usuario. Revisá que el email no exista ya.");
    }
  };

  const openDeleteConfirm = (user: any) => {
    if (user.role === "owner") {
      alert("No podés eliminar al Dueño.");
      return;
    }

    const hasChildren = users.some((u: any) => u.reportsTo === user.id);
    if (hasChildren) {
      alert("No se puede eliminar: el usuario tiene integrantes a cargo. Primero reasigna/elimina a sus subordinados.");
      return;
    }

    const hasAssignedLeads = leads.some((l) => l.vendedor === user.id);
    if (hasAssignedLeads) {
      alert("No se puede eliminar: el usuario tiene leads asignados. Reasignalos primero.");
      return;
    }

    setUserToDelete(user);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await apiDeleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u: any) => u.id !== userToDelete.id));
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    } catch (e) {
      console.error("No pude eliminar usuario", e);
      alert("Error al eliminar el usuario. Intentá de nuevo.");
    }
  };

  // ===== Crear Lead (modal) =====
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showObservacionesModal, setShowObservacionesModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [editingLeadObservaciones, setEditingLeadObservaciones] = useState<LeadRow | null>(null);
  const [viewingLeadHistorial, setViewingLeadHistorial] = useState<LeadRow | null>(null);

  const handleUpdateObservaciones = async (leadId: number, observaciones: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { notas: observaciones } as any);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l))
      );
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

    // Si el creador es vendedor/supervisor/gerente => la fuente es "creado_por:<id>"
    const creatorIsManual =
      currentUser && ["vendedor", "supervisor", "gerente"].includes(currentUser.role);

    let fuente: string;
    if (creatorIsManual) {
      fuente = `creado_por:${currentUser.id}`;
    } else {
      // Para owner/director dejo elegir fuente
      const fuenteSel = (document.getElementById("new-fuente") as HTMLSelectElement)?.value || "otro";
      fuente = fuenteSel;
    }

    // Asignación
    const autoAssign = (document.getElementById("new-autoassign") as HTMLInputElement)?.checked;
    const vendedorSelVal = (document.getElementById("new-vendedor") as HTMLSelectElement).value;
    const vendedorIdSelRaw = parseInt(vendedorSelVal, 10);
    const vendedorIdSel = Number.isNaN(vendedorIdSelRaw) ? null : vendedorIdSelRaw;

    let vendedorId: number | null = null;

    if (autoAssign) {
      // Round-robin en el scope del usuario
      vendedorId = pickNextVendorId(currentUser, creatorIsManual ? undefined : fuente) ?? vendedorIdSel ?? null;
    } else {
      if (vendedorIdSel !== null) {
        // validar que el vendedor seleccionado esté activo
        const selectedVendor = users.find((u) => u.id === vendedorIdSel);
        if (selectedVendor && selectedVendor.active) {
          // Validar que esté dentro del scope permitido
          const allowedIds = getAvailableVendorsForReassign().map((u: any) => u.id);
          if (allowedIds.includes(vendedorIdSel)) {
            vendedorId = vendedorIdSel;
          } else {
            alert("No podés asignar leads fuera de tu equipo.");
            return;
          }
        } else if (vendedorIdSel) {
          alert("El vendedor seleccionado está desactivado.");
          return;
        } else {
          vendedorId = null;
        }
      }
    }

    if (nombre && telefono && modelo) {
      try {
        const created = await apiCreateLead({
          nombre,
          telefono,
          modelo,
          formaPago,
          notas: "",
          estado: "nuevo",
          fuente, // <<<<<< importante: creado_por:<id> para roles vendedor/supervisor/gerente
          infoUsado,
          entrega,
          fecha,
          vendedor: vendedorId,
        } as any);

        const mapped = mapLeadFromApi(created);

        if (mapped.vendedor) {
          pushAlert(
            mapped.vendedor,
            "lead_assigned",
            `Nuevo lead asignado: ${mapped.nombre}`
          );
        }

        setLeads((prev) => [mapped, ...prev]);
        setShowNewLeadModal(false);
        addHistorialEntry(mapped.id, "nuevo");
      } catch (e) {
        console.error("No pude crear el lead", e);
        alert("Error al crear el lead.");
      }
    } else {
      alert("Nombre, teléfono y modelo son obligatorios.");
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
            {!currentUser?.active && (
              <p className="text-red-300 text-xs mt-1">
                ⚠️ Usuario desactivado - No recibe leads nuevos
              </p>
            )}
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
            ...(canManageUsers()
              ? [{ key: "users", label: "Usuarios", Icon: Settings }]
              : []),
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
      <div className="flex-1 p-6">
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
                      <option key={gerente.id} value={gerente.id.toString()}>
                        Equipo {gerente.name}
                      </option>
                    ))}
                </select>
              )}
            </div>

            {!currentUser?.active && (
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Bell className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-orange-700">
                      <strong>Usuario Desactivado:</strong> No recibirás nuevos leads automáticamente.
                      Solo podrás gestionar los leads que ya tenés asignados.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(() => {
                const teamFilter = ["owner", "director"].includes(currentUser?.role)
                  ? selectedTeam
                  : undefined;
                const stats = getDashboardStats(teamFilter);
                return (
                  <>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Leads</p>
                          <p className="text-3xl font-bold text-gray-900">{stats.totalLeads}</p>
                        </div>
                        <div className="bg-blue-500 p-3 rounded-full">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Ventas</p>
                          <p className="text-3xl font-bold text-green-600">{stats.vendidos}</p>
                        </div>
                        <div className="bg-green-500 p-3 rounded-full">
                          <Trophy className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Conversión</p>
                          <p className="text-3xl font-bold text-purple-600">{stats.conversion}%</p>
                        </div>
                        <div className="bg-purple-500 p-3 rounded-full">
                          <BarChart3 className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Estados de Leads */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Estados de Leads</h3>
                <div className="flex items-center gap-3">
                  {["owner", "director"].includes(currentUser?.role) && (
                    <button
                      onClick={() => {
                        const teamFilter = ["owner", "director"].includes(currentUser?.role)
                          ? selectedTeam
                          : undefined;
                        const filteredLeads =
                          teamFilter && teamFilter !== "todos"
                            ? getFilteredLeadsByTeam(teamFilter)
                            : getFilteredLeads();
                        downloadAllLeadsExcel(filteredLeads, userById);
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1"
                      title="Descargar Excel completo"
                    >
                      <Download size={12} />
                      <span>Todos</span>
                    </button>
                  )}
                  {selectedEstado && (
                    <button
                      onClick={() => setSelectedEstado(null)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <X size={16} />
                      <span>Cerrar filtro</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(estados).map(([key, estado]) => {
                  const teamFilter = ["owner", "director"].includes(currentUser?.role)
                    ? selectedTeam
                    : undefined;
                  const filteredLeads =
                    teamFilter && teamFilter !== "todos"
                      ? getFilteredLeadsByTeam(teamFilter)
                      : getFilteredLeads();
                  const count = filteredLeads.filter((l) => l.estado === key).length;
                  const percentage =
                    filteredLeads.length > 0 ? ((count / filteredLeads.length) * 100).toFixed(1) : "0";
                  return (
                    <div key={key} className="relative group">
                      <button
                        onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                        className={`w-full text-center transition-all duration-200 transform hover:scale-105 ${
                          selectedEstado === key ? "ring-4 ring-blue-300 ring-opacity-50 rounded-lg" : ""
                        }`}
                        title={`Ver todos los leads en estado: ${estado.label}`}
                      >
                        <div
                          className={`${estado.color} text-white rounded-lg p-4 mb-2 relative cursor-pointer hover:opacity-90 transition-opacity`}
                        >
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-xs opacity-75">{percentage}%</div>

                          {["owner", "director"].includes(currentUser?.role) && count > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const tf = ["owner", "director"].includes(currentUser?.role)
                                  ? selectedTeam
                                  : undefined;
                                const fl =
                                  tf && tf !== "todos" ? getFilteredLeadsByTeam(tf) : getFilteredLeads();
                                downloadLeadsByStateExcel(fl, key, userById);
                              }}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-20 hover:bg-opacity-40 rounded p-1"
                              title={`Descargar Excel: ${estado.label}`}
                            >
                              <Download size={12} />
                            </button>
                          )}
                        </div>
                      </button>
                      <div className="text-sm text-gray-600 text-center font-medium">
                        {estado.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabla de leads del estado seleccionado (con cambio de estado inline) */}
              {selectedEstado && (
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">
                    Leads en estado:{" "}
                    <span
                      className={`px-3 py-1 rounded-full text-white text-sm ${estados[selectedEstado].color}`}
                    >
                      {estados[selectedEstado].label}
                    </span>
                  </h4>
                  {(() => {
                    const teamFilter = ["owner", "director"].includes(currentUser?.role)
                      ? selectedTeam
                      : undefined;
                    const filteredLeads =
                      teamFilter && teamFilter !== "todos"
                        ? getFilteredLeadsByTeam(teamFilter)
                        : getFilteredLeads();
                    const leadsFiltrados = filteredLeads.filter((l) => l.estado === selectedEstado);

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
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {leadsFiltrados.map((lead) => {
                              const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                              const fuenteLabel = fuenteToLabel(lead.fuente as string, userById);

                              return (
                                <tr key={lead.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2">
                                    <div className="font-medium text-gray-900">{lead.nombre}</div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-1">
                                      <Phone size={12} className="text-gray-400" />
                                      <span className="text-gray-700">{lead.telefono}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div>
                                      <div className="font-medium text-gray-900">{lead.modelo}</div>
                                      <div className="text-xs text-gray-500">{lead.formaPago}</div>
                                      {lead.infoUsado && (
                                        <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <select
                                      value={lead.estado}
                                      onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                                      className={`text-xs font-medium rounded-full px-2 py-1 border-0 text-white ${estados[lead.estado].color}`}
                                    >
                                      {Object.entries(estados).map(([key, estado]) => (
                                        <option key={key} value={key} className="text-black">
                                          {estado.label}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-1">
                                      <span className="text-sm">{fuenteLabel.icon}</span>
                                      <span className="text-xs text-gray-600">{fuenteLabel.label}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-gray-700">
                                    {vendedor?.name || "Sin asignar"}
                                  </td>
                                  <td className="px-4 py-2 text-gray-500 text-xs">
                                    {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
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
                                          openReassignModal(lead);
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                                        title="Reasignar lead"
                                      >
                                        Reasignar
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

            {/* Performance por fuente */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Performance por Fuente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const teamFilter = ["owner", "director"].includes(currentUser?.role)
                    ? selectedTeam
                    : undefined;
                  return getSourceMetrics(teamFilter).map((item) => (
                    <div key={item.source} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{item.icon}</span>
                        <span className="font-medium text-gray-900">{item.label}</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-semibold">{item.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ventas:</span>
                          <span className="font-semibold text-green-600">{item.vendidos}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Conversión:</span>
                          <span className="font-semibold text-purple-600">{item.conversion}%</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Leads */}
        {activeSection === "leads" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Gestión de Leads</h2>
              {canCreateLeads && (
                <button
                  onClick={() => setShowNewLeadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Lead</span>
                </button>
              )}
            </div>

            {/* Búsqueda y filtros */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, teléfono, modelo, vendedor, observaciones..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      showFilters || getActiveFiltersCount() > 0
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Filter size={20} />
                    <span>Filtros</span>
                    {getActiveFiltersCount() > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                        {getActiveFiltersCount()}
                      </span>
                    )}
                  </button>

                  {getActiveFiltersCount() > 0 && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      <X size={16} />
                      <span>Limpiar</span>
                    </button>
                  )}

                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{getFilteredAndSearchedLeads().length}</span>{" "}
                    leads encontrados
                  </div>
                </div>
              </div>

              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <User size={16} className="inline mr-1" />
                        Vendedor
                      </label>
                      <select
                        value={selectedVendedorFilter ?? ""}
                        onChange={(e) =>
                          setSelectedVendedorFilter(e.target.value ? parseInt(e.target.value, 10) : null)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos los vendedores</option>
                        <option value="0">Sin asignar</option>
                        {getVisibleUsers()
                          .filter((u: any) => u.role === "vendedor")
                          .map((vendedor: any) => {
                            const leadsCount = leads.filter((l) => l.vendedor === vendedor.id).length;
                            return (
                              <option key={vendedor.id} value={vendedor.id}>
                                {vendedor.name} ({leadsCount} leads) {!vendedor.active ? " - Inactivo" : ""}
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                      <select
                        value={selectedEstadoFilter}
                        onChange={(e) => setSelectedEstadoFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos los estados</option>
                        {Object.entries(estados).map(([key, estado]) => (
                          <option key={key} value={key}>
                            {estado.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fuente</label>
                      <select
                        value={selectedFuenteFilter}
                        onChange={(e) => setSelectedFuenteFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todas las fuentes</option>
                        {Object.entries(fuentes).map(([key, fuente]) => (
                          <option key={key} value={key}>
                            {fuente.icon} {fuente.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tabla de leads */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredAndSearchedLeads().length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          {searchText.trim() ||
                          selectedVendedorFilter !== null ||
                          selectedEstadoFilter ||
                          selectedFuenteFilter
                            ? "No se encontraron leads que coincidan con los filtros aplicados"
                            : "No hay leads para mostrar"}
                        </td>
                      </tr>
                    ) : (
                      getFilteredAndSearchedLeads().map((lead) => {
                        const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                        const fuenteLabel = fuenteToLabel(lead.fuente as string, userById);
                        const canReassign =
                          canManageUsers() ||
                          (currentUser?.role === "supervisor" &&
                            lead.vendedor &&
                            getVisibleUsers().some((u: any) => u.id === lead.vendedor));

                        return (
                          <tr key={lead.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <div className="font-medium text-gray-900">{lead.nombre}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1">
                                <Phone size={12} className="text-gray-400" />
                                <span className="text-gray-700">{lead.telefono}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div>
                                <div className="font-medium text-gray-900">{lead.modelo}</div>
                                <div className="text-xs text-gray-500">{lead.formaPago}</div>
                                {lead.infoUsado && (
                                  <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <select
                                value={lead.estado}
                                onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                                className={`text-xs font-medium rounded-full px-2 py-1 border-0 text-white ${estados[lead.estado].color}`}
                              >
                                {Object.entries(estados).map(([key, estado]) => (
                                  <option key={key} value={key} className="text-black">
                                    {estado.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1">
                                <span className="text-sm">{fuenteLabel.icon}</span>
                                <span className="text-xs text-gray-600">{fuenteLabel.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-700">
                              <div>
                                {vendedor?.name || "Sin asignar"}
                                {vendedor && !vendedor.active && (
                                  <div className="text-xs text-red-600">(Desactivado)</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-500 text-xs">
                              {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
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
                                {canReassign && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openReassignModal(lead);
                                    }}
                                    className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                                    title="Reasignar lead"
                                  >
                                    Reasignar
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingLeadHistorial(lead);
                                    setShowHistorialModal(true);
                                  }}
                                  className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  title="Ver historial"
                                >
                                  Historial
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Sección Calendario */}
        {activeSection === "calendar" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Calendario</h2>
              <div className="flex items-center gap-3">
                <select
                  value={selectedCalendarUserId ?? ""}
                  onChange={(e) =>
                    setSelectedCalendarUserId(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
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
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Evento</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Próximos eventos -{" "}
                {selectedCalendarUserId ? userById.get(selectedCalendarUserId)?.name : "Mi calendario"}
              </h3>

              {eventsForSelectedUser.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay eventos programados</p>
              ) : (
                <div className="space-y-3">
                  {eventsForSelectedUser.map((event: any) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                        <p className="text-sm text-gray-600">
                          {formatterEs.format(new Date(event.date))} a las {event.time}
                        </p>
                        <p className="text-xs text-gray-500">
                          {userById.get(event.userId)?.name || "Usuario desconocido"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
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

            {/* Modal: Nuevo Evento */}
            {showNewEventModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-800">Nuevo Evento</h3>
                    <button onClick={() => setShowNewEventModal(false)}>
                      <X size={24} className="text-gray-600" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                      <input
                        type="text"
                        id="ev-title"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                      <input
                        type="date"
                        id="ev-date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                      <input
                        type="time"
                        id="ev-time"
                        defaultValue="09:00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                      <select id="ev-user" className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                        <option value={currentUser?.id}>{currentUser?.name} (Yo)</option>
                        {visibleUsers
                          .filter((u: any) => u.id !== currentUser?.id)
                          .map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6">
                    <button
                      onClick={createEvent}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Crear Evento
                    </button>
                    <button
                      onClick={() => setShowNewEventModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sección Ranking */}
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
                        <div className="flex items-center gap-3">
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
                  </div>
                  {getRanking().length === 0 && (
                    <p className="text-gray-500 text-center py-8">No hay vendedores registrados</p>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  {currentUser?.role === "vendedor"
                    ? "Ranking Vendedores"
                    : isOwner()
                    ? "Mi Scope"
                    : "Ranking"}
                </h3>
                <div className="space-y-3">
                  {(currentUser?.role === "vendedor" ? getRankingByManagerialTeam() : getRankingInScope()).map(
                    (vendedor, index) => (
                      <div
                        key={vendedor.id}
                        className={`flex items-center justify-between p-4 border border-gray-200 rounded-lg ${
                          vendedor.id === currentUser?.id ? "bg-blue-50 border-blue-300" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
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
                            <p
                              className={`font-medium ${
                                vendedor.id === currentUser?.id ? "text-blue-900" : "text-gray-900"
                              }`}
                            >
                              {vendedor.nombre}
                              {vendedor.id === currentUser?.id && (
                                <span className="ml-2 text-xs text-blue-600 font-normal">(Tú)</span>
                              )}
                            </p>
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
                    )
                  )}
                </div>
                {(currentUser?.role === "vendedor" ? getRankingByManagerialTeam() : getRankingInScope()).length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    {currentUser?.role === "vendedor" ? "No hay otros vendedores en tu gerencia" : "No hay vendedores en tu scope"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sección Mi Equipo */}
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
                    <option value="todos">Todos los equipos</option>
                    {users
                      .filter((u: any) => u.role === "gerente")
                      .map((gerente: any) => (
                        <option key={gerente.id} value={gerente.id.toString()}>
                          Equipo {gerente.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* Estados por equipo */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">Estados de Leads - Mi Equipo</h3>
                  {selectedEstado && (
                    <button
                      onClick={() => setSelectedEstado(null)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <X size={16} />
                      <span>Cerrar filtro</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(estados).map(([key, estado]) => {
                    const teamFilter = ["owner", "director"].includes(currentUser?.role)
                      ? selectedTeam
                      : undefined;
                    const filteredLeads =
                      teamFilter && teamFilter !== "todos"
                        ? getFilteredLeadsByTeam(teamFilter)
                        : getFilteredLeads();
                    const count = filteredLeads.filter((l) => l.estado === key).length;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                        className={`text-center transition-all duration-200 transform hover:scale-105 ${
                          selectedEstado === key ? "ring-4 ring-blue-300 ring-opacity-50 rounded-lg" : ""
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

                {/* Tabla filtrada de mi equipo (con cambio de estado inline) */}
                {selectedEstado && (
                  <div className="mt-6 border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">
                      Leads de mi equipo en estado:{" "}
                      <span
                        className={`px-3 py-1 rounded-full text-white text-sm ${estados[selectedEstado].color}`}
                      >
                        {estados[selectedEstado].label}
                      </span>
                    </h4>
                    {(() => {
                      const teamFilter = ["owner", "director"].includes(currentUser?.role)
                        ? selectedTeam
                        : undefined;
                      const filteredLeads =
                        teamFilter && teamFilter !== "todos"
                          ? getFilteredLeadsByTeam(teamFilter)
                          : getFilteredLeads();
                      const leadsFiltrados = filteredLeads.filter((l) => l.estado === selectedEstado);

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
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {leadsFiltrados.map((lead) => {
                                const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                                const fuenteLabel = fuenteToLabel(lead.fuente as string, userById);
                                return (
                                  <tr key={lead.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2">
                                      <div className="font-medium text-gray-900">{lead.nombre}</div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center gap-1">
                                        <Phone size={12} className="text-gray-400" />
                                        <span className="text-gray-700">{lead.telefono}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div>
                                        <div className="font-medium text-gray-900">{lead.modelo}</div>
                                        <div className="text-xs text-gray-500">{lead.formaPago}</div>
                                        {lead.infoUsado && (
                                          <div className="text-xs text-orange-600">Usado: {lead.infoUsado}</div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <select
                                        value={lead.estado}
                                        onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 text-white ${estados[lead.estado].color}`}
                                      >
                                        {Object.entries(estados).map(([key, estado]) => (
                                          <option key={key} value={key} className="text-black">
                                            {estado.label}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center gap-1">
                                        <span className="text-sm">{fuenteLabel.icon}</span>
                                        <span className="text-xs text-gray-600">{fuenteLabel.label}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-gray-700">
                                      {vendedor?.name || "Sin asignar"}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 text-xs">
                                      {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <div className="flex items-center justify-center gap-1">
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
                                            openReassignModal(lead);
                                          }}
                                          className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                                          title="Reasignar lead"
                                        >
                                          Reasignar
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
                    <div
                      key={vendedor.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
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

        {/* Sección Usuarios */}
        {activeSection === "users" && canManageUsers() && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h2>
              {/* Sólo Dueño/Director/Gerente ven el botón */}
              <button
                onClick={openCreateUser}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                            <div className="flex items-center gap-2">
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
                                      setUsers((prev) =>
                                        prev.map((u: any) => (u.id === user.id ? updated : u))
                                      );
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
                            {user.role === "vendedor" && !user.active && (
                              <div className="text-xs text-orange-600 mt-1">No recibe leads nuevos</div>
                            )}
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
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditUser(user)}
                                className="p-1 text-blue-600 hover:text-blue-800"
                                title="Editar usuario"
                              >
                                <Edit3 size={16} />
                              </button>
                              {isOwner() && user.id !== currentUser?.id && (
                                <button
                                  onClick={() => openDeleteConfirm(user)}
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

            {/* Modal: Usuario */}
            {showUserModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-800">
                      {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
                    </h3>
                    <button onClick={() => setShowUserModal(false)}>
                      <X size={24} className="text-gray-600" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                      <input
                        type="text"
                        id="u-name"
                        defaultValue={editingUser?.name || ""}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        id="u-email"
                        defaultValue={editingUser?.email || ""}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contraseña {editingUser && "(dejar vacío para mantener)"}
                      </label>
                      <input
                        type="password"
                        value={password1}
                        onChange={(e) => setPassword1(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder={editingUser ? "Nueva contraseña (opcional)" : "Contraseña"}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirmar contraseña
                      </label>
                      <input
                        type="password"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Repetí la contraseña"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                      <select
                        value={modalRole}
                        onChange={(e) => {
                          const newRole = e.target.value as typeof modalRole;
                          setModalRole(newRole);
                          const validManagers = validManagersByRole(newRole);
                          setModalReportsTo(validManagers[0]?.id ?? null);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {validRolesByUser(currentUser).map((role: string) => (
                          <option key={role} value={role}>
                            {roles[role] || role}
                          </option>
                        ))}
                      </select>
                    </div>
                    {modalRole !== "owner" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reporta a</label>
                        <select
                          value={modalReportsTo || ""}
                          onChange={(e) =>
                            setModalReportsTo(e.target.value ? parseInt(e.target.value, 10) : null)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          {validManagersByRole(modalRole).map((manager: any) => (
                            <option key={manager.id} value={manager.id}>
                              {manager.name} ({roles[manager.role] || manager.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="u-active"
                        defaultChecked={editingUser?.active !== false}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <label htmlFor="u-active" className="text-sm text-gray-700">
                        Usuario activo
                      </label>
                    </div>
                    {modalRole === "vendedor" && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-700">
                          <strong>Nota:</strong> Los vendedores desactivados pueden seguir usando el CRM,
                          pero no recibirán leads nuevos automáticamente.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-6">
                    <button
                      onClick={saveUser}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {editingUser ? "Actualizar" : "Crear"} Usuario
                    </button>
                    <button
                      onClick={() => setShowUserModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal confirmación eliminar usuario */}
            {showDeleteConfirmModal && userToDelete && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md">
                  <div className="flex items-center mb-6">
                    <div className="bg-red-100 p-3 rounded-full mr-4">
                      <Trash2 className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Confirmar Eliminación</h3>
                      <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 className="font-medium text-gray-800 mb-2">Usuario a eliminar:</h4>
                    <div className="text-sm space-y-1">
                      <div>
                        <strong>Nombre:</strong> {userToDelete.name}
                      </div>
                      <div>
                        <strong>Email:</strong> {userToDelete.email}
                      </div>
                      <div>
                        <strong>Rol:</strong> {roles[userToDelete.role] || userToDelete.role}
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Bell className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-red-800">Atención - Eliminación Permanente</h4>
                        <div className="mt-2 text-sm text-red-700">
                          <ul className="list-disc pl-5 space-y-1">
                            <li>Se eliminará permanentemente del sistema</li>
                            <li>Se perderá acceso a todas las funcionalidades</li>
                            <li>No podrá recuperar su cuenta</li>
                            <li>Los datos históricos se mantienen para auditoría</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={confirmDeleteUser}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                      Sí, Eliminar Usuario
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirmModal(false);
                        setUserToDelete(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sección Alertas */}
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
                  <p className="text-gray-500">No tenés alertas pendientes</p>
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
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-1 w-2 h-2 rounded-full ${
                                alert.read ? "bg-gray-400" : "bg-blue-500"
                              }`}
                            />
                            <div>
                              <p className={`font-medium ${alert.read ? "text-gray-700" : "text-gray-900"}`}>
                                {alert.type === "lead_assigned" ? "Nuevo Lead Asignado" : "Cambio en Ranking"}
                              </p>
                              <p className={`${alert.read ? "text-gray-500" : "text-gray-700"} text-sm`}>
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
    </div>
  );
}
