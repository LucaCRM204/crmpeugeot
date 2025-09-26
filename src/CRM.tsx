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

// NUEVOS: Tipos para el sistema de cotización/presupuestación
type VehiculoConfig = {
  marca: string;
  modelo: string;
  anio: number;
  precio_base: number;
  configuraciones: {
    basico: { precio: number; descripcion: string };
    intermedio: { precio: number; descripcion: string };
    full: { precio: number; descripcion: string };
  };
};

type PlanFinanciacion = {
  id: string;
  nombre: string;
  cuotas: number;
  tasa_mensual: number;
  enganche_minimo: number;
  descripcion: string;
};

type CotizacionData = {
  vehiculo: VehiculoConfig;
  configuracion: 'basico' | 'intermedio' | 'full';
  plan_financiacion: PlanFinanciacion;
  vehiculo_usado?: {
    marca: string;
    modelo: string;
    anio: number;
    valor_estimado: number;
  };
  descuentos: {
    porcentaje: number;
    descripcion: string;
  }[];
  total_final: number;
  cuota_mensual: number;
};
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
  creado_por: { label: "Creado por", color: "bg-teal-500", icon: "👤" }, // NUEVA FUENTE
};

// Configuración de bots
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
  fuente: keyof typeof fuentes | string;
  historial?: Array<{
    estado: string;
    timestamp: string;
    usuario: string;
  }>;
  created_by?: number;
  presupuesto?: string; // NUEVO: Campo para presupuesto Azofix
  cotizador?: string;   // NUEVO: Campo para cotizador Azofix
};

type Alert = {
  id: number;
  userId: number;
  type: "lead_assigned" | "ranking_change";
  message: string;
  ts: string;
  read: boolean;
};

// ===== Funciones de descarga Excel =====
const formatDate = (dateString: string): string => {
  if (!dateString) return "Sin fecha";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-AR");
};

const downloadAllLeadsExcel = (leads: LeadRow[], userById: Map<number, any>, fuentes: any): void => {
  // Crear datos para Excel
  const excelData = leads.map(lead => {
    const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
    const fuente = fuentes[lead.fuente] || { label: lead.fuente };
    const creadoPor = lead.created_by ? userById.get(lead.created_by) : null;
    
    return {
      'ID': lead.id,
      'Cliente': lead.nombre,
      'Teléfono': lead.telefono,
      'Modelo': lead.modelo,
      'Forma de Pago': lead.formaPago || '',
      'Info Usado': lead.infoUsado || '',
      'Entrega': lead.entrega ? 'Sí' : 'No',
      'Estado': estados[lead.estado]?.label || lead.estado,
      'Fuente': fuente.label,
      'Vendedor': vendedor?.name || 'Sin asignar',
      'Equipo': vendedor && vendedor.reportsTo ? `Equipo de ${userById.get(vendedor.reportsTo)?.name || '—'}` : '',
      'Fecha': formatDate(lead.fecha || ''),
      'Creado Por': creadoPor?.name || 'Sistema',
      'Observaciones': lead.notas || ''
    };
  });

  // Crear contenido CSV
  const headers = Object.keys(excelData[0] || {});
  const csvContent = [
    headers.join(','),
    ...excelData.map(row => 
      headers.map(header => {
        const value = (row as any)[header] || '';
        // Escapar comillas y comas
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  // Crear y descargar archivo
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `todos_los_leads_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadLeadsByStateExcel = (leads: LeadRow[], estado: string, userById: Map<number, any>, fuentes: any): void => {
  const leadsByState = leads.filter(l => l.estado === estado);

  if (leadsByState.length === 0) {
    alert(`No hay leads en estado "${estados[estado]?.label || estado}"`);
    return;
  }

  // Crear datos para Excel
  const excelData = leadsByState.map(lead => {
    const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
    const fuente = fuentes[lead.fuente] || { label: lead.fuente };
    const creadoPor = lead.created_by ? userById.get(lead.created_by) : null;
    
    return {
      'ID': lead.id,
      'Cliente': lead.nombre,
      'Teléfono': lead.telefono,
      'Modelo': lead.modelo,
      'Forma de Pago': lead.formaPago || '',
      'Info Usado': lead.infoUsado || '',
      'Entrega': lead.entrega ? 'Sí' : 'No',
      'Fuente': fuente.label,
      'Vendedor': vendedor?.name || 'Sin asignar',
      'Equipo': vendedor && vendedor.reportsTo ? `Equipo de ${userById.get(vendedor.reportsTo)?.name || '—'}` : '',
      'Fecha': formatDate(lead.fecha || ''),
      'Creado Por': creadoPor?.name || 'Sistema',
      'Observaciones': lead.notas || '',
      'Historial': lead.historial?.map(h => 
        `${formatDate(h.timestamp)}: ${h.estado} (${h.usuario})`
      ).join(' | ') || ''
    };
  });

  // Crear contenido CSV
  const headers = Object.keys(excelData[0] || {});
  const csvContent = [
    headers.join(','),
    ...excelData.map(row => 
      headers.map(header => {
        const value = (row as any)[header] || '';
        // Escapar comillas y comas
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  // Crear y descargar archivo
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  const estadoLabel = estados[estado]?.label || estado;
  link.setAttribute('download', `leads_${estadoLabel.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
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
    "dashboard" | "leads" | "calendar" | "ranking" | "users" | "alerts" | "team" | "plantillas"
  >("dashboard");
  const [loginError, setLoginError] = useState("");
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("todos");

  // Estados para búsqueda y filtrado de leads
  const [searchText, setSearchText] = useState("");
  const [selectedVendedorFilter, setSelectedVendedorFilter] = useState<number | null>(null);
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState<string>("");
  const [selectedFuenteFilter, setSelectedFuenteFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Estados para reasignación
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [leadToReassign, setLeadToReassign] = useState<LeadRow | null>(null);
  const [selectedVendorForReassign, setSelectedVendorForReassign] =
    useState<number | null>(null);

  // Estados para confirmación de eliminación
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  // Estados para presupuesto y cotizador (mantener compatibilidad)
  const [showPresupuestoModal, setShowPresupuestoModal] = useState(false);
  const [showCotizadorModal, setShowCotizadorModal] = useState(false);
  const [editingLeadPresupuesto, setEditingLeadPresupuesto] = useState<LeadRow | null>(null);
  const [editingLeadCotizador, setEditingLeadCotizador] = useState<LeadRow | null>(null);

  // NUEVOS: Estados para sistema de cotización avanzado
  const [showCotizadorAvanzadoModal, setShowCotizadorAvanzadoModal] = useState(false);
  const [leadParaCotizar, setLeadParaCotizar] = useState<LeadRow | null>(null);
  const [cotizacionActual, setCotizacionActual] = useState<CotizacionData | null>(null);
  
  // Estados para gestión de plantillas de presupuestos
  const [showGestionPlantillasModal, setShowGestionPlantillasModal] = useState(false);
  const [showCrearPlantillaModal, setShowCrearPlantillaModal] = useState(false);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaPresupuesto | null>(null);
  const [plantillasLocal, setPlantillasLocal] = useState<PlantillaPresupuesto[]>(plantillasPresupuestos);

  // ===== Login contra backend =====
  const handleLogin = async (email: string, password: string) => {
    try {
      // MODIFICADO: Enviar parámetro para permitir login de usuarios desactivados
      const r = await api.post("/auth/login", { 
        email, 
        password, 
        allowInactiveUsers: true // Permitir acceso a usuarios desactivados
      });

      // Verificar respuesta exitosa
      if (r.data?.ok && r.data?.token) {
        // Guardar token
        localStorage.setItem("token", r.data.token);
        localStorage.setItem("user", JSON.stringify(r.data.user));

        // Configurar axios para futuras peticiones
        api.defaults.headers.common["Authorization"] = `Bearer ${r.data.token}`;

        const u =
          r.data.user || {
            id: 0,
            name: r.data?.user?.email || email,
            email,
            role: r.data?.user?.role || "owner",
            reportsTo: null,
            active: r.data?.user?.active ?? true, // IMPORTANTE: Mantener el estado real del usuario
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
          created_by: L.created_by || null, // NUEVO
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
  
  // MODIFICADO: Función para verificar quién puede crear usuarios
  const canCreateUsers = () =>
    currentUser && ["owner", "director", "gerente"].includes(currentUser.role);

  const canManageUsers = () =>
    currentUser && ["owner", "director", "gerente"].includes(currentUser.role);
  const isOwner = () => currentUser?.role === "owner";

  // NUEVO: Función para verificar quién puede crear leads
  const canCreateLeads = () =>
    currentUser && ["owner", "director", "gerente", "supervisor", "vendedor"].includes(currentUser.role);

  // ===== Funciones de filtro por equipo =====
  const getTeamManagerById = (teamId: string) => {
    if (teamId === "todos") return null;
    return users.find(
      (u: any) => u.role === "gerente" && u.id.toString() === teamId
    );
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
      // Filtrar por equipo específico usando ID
      const teamUserIds = getTeamUserIds(teamId);
      return leads.filter((l) =>
        l.vendedor ? teamUserIds.includes(l.vendedor) : false
      );
    }

    // Filtro normal por scope del usuario
    const visibleUserIds = getAccessibleUserIds(currentUser);
    return leads.filter((l) =>
      l.vendedor ? visibleUserIds.includes(l.vendedor) : true
    );
  };

  // ===== NUEVO: Función para obtener vendedores disponibles según el rol del usuario para asignación =====
  const getAvailableVendorsForAssignment = () => {
    if (!currentUser) return [];

    // Obtener usuarios visibles según el rol
    const visibleUserIds = getAccessibleUserIds(currentUser);
    
    return users.filter((u: any) => {
      // Solo vendedores activos
      if (u.role !== "vendedor" || !u.active) return false;
      
      // Verificar que esté en el scope del usuario actual
      if (!visibleUserIds.includes(u.id)) return false;
      
      return true;
    });
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

      // Vendedor solo se ve a sí mismo
      if (currentUser.role === "vendedor") {
        return u.id === currentUser.id;
      }

      return false;
    });
  };

  // ===== Función para obtener leads filtrados y buscados =====
  const getFilteredAndSearchedLeads = () => {
    if (!currentUser) return [] as LeadRow[];

    // Comenzar con leads base según scope
    const visibleUserIds = getAccessibleUserIds(currentUser);
    let filteredLeads = leads.filter((l) =>
      l.vendedor ? visibleUserIds.includes(l.vendedor) : true
    );

    // Aplicar filtro por vendedor específico
    if (selectedVendedorFilter) {
      filteredLeads = filteredLeads.filter((l) => l.vendedor === selectedVendedorFilter);
    }

    // Aplicar filtro por estado
    if (selectedEstadoFilter) {
      filteredLeads = filteredLeads.filter((l) => l.estado === selectedEstadoFilter);
    }

    // Aplicar filtro por fuente
    if (selectedFuenteFilter) {
      filteredLeads = filteredLeads.filter((l) => l.fuente === selectedFuenteFilter);
    }

    // Aplicar búsqueda de texto
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      filteredLeads = filteredLeads.filter((l) => {
        const vendedor = l.vendedor ? userById.get(l.vendedor) : null;
        const creadoPor = l.created_by ? userById.get(l.created_by) : null;
        return (
          l.nombre.toLowerCase().includes(searchLower) ||
          l.telefono.includes(searchText.trim()) ||
          l.modelo.toLowerCase().includes(searchLower) ||
          (l.notas && l.notas.toLowerCase().includes(searchLower)) ||
          (vendedor && vendedor.name.toLowerCase().includes(searchLower)) ||
          (creadoPor && creadoPor.name.toLowerCase().includes(searchLower)) ||
          (l.formaPago && l.formaPago.toLowerCase().includes(searchLower)) ||
          (l.infoUsado && l.infoUsado.toLowerCase().includes(searchLower))
        );
      });
    }

    return filteredLeads;
  };

  // ===== Función para limpiar filtros =====
  const clearFilters = () => {
    setSearchText("");
    setSelectedVendedorFilter(null);
    setSelectedEstadoFilter("");
    setSelectedFuenteFilter("");
  };

  // ===== Función para contar leads activos por filtros =====
  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchText.trim()) count++;
    if (selectedVendedorFilter) count++;
    if (selectedEstadoFilter) count++;
    if (selectedFuenteFilter) count++;
    return count;
  };

  // ===== Función para obtener vendedores disponibles según el rol del usuario =====
  const getAvailableVendorsForReassign = () => {
    if (!currentUser) return [];

    // Obtener usuarios visibles según el rol
    const visibleUsers = getVisibleUsers();

    // Filtrar solo vendedores activos
    return visibleUsers.filter((u: any) => u.role === "vendedor" && u.active);
  };

  // ===== Función para abrir modal de reasignación =====
  const openReassignModal = (lead: LeadRow) => {
    setLeadToReassign(lead);
    setSelectedVendorForReassign(lead.vendedor);
    setShowReassignModal(true);
  };

  // ===== Función para reasignar lead =====
  const handleReassignLead = async () => {
    if (!leadToReassign) return;

    try {
      await apiUpdateLead(
        leadToReassign.id,
        { vendedor: selectedVendorForReassign } as any
      );

      // Actualizar estado local
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadToReassign.id
          ? { ...l, vendedor: selectedVendorForReassign }
          : l
        )
      );

      // Enviar notificación al nuevo vendedor
      if (selectedVendorForReassign) {
        pushAlert(
          selectedVendorForReassign,
          "lead_assigned",
          `Lead reasignado: ${leadToReassign.nombre} - ${leadToReassign.modelo}`
        );
      }

      // Agregar entrada al historial
      addHistorialEntry(
        leadToReassign.id,
        `Reasignado a ${
          selectedVendorForReassign
            ? userById.get(selectedVendorForReassign)?.name
            : "Sin asignar"
        }`
      );

      setShowReassignModal(false);
      setLeadToReassign(null);
      setSelectedVendorForReassign(null);
    } catch (e) {
      console.error("No pude reasignar el lead", e);
    }
  };

  // ===== Round-robin con soporte para bots específicos - MODIFICADO =====
  const [rrIndex, setRrIndex] = useState(0);

  // MODIFICADO: Solo obtener vendedores ACTIVOS
  const getActiveVendorIdsInScope = (scopeUser?: any) => {
    if (!scopeUser) return [] as number[];
    const scope = getAccessibleUserIds(scopeUser);
    return users
      .filter(
        (u: any) => u.role === "vendedor" && u.active && scope.includes(u.id)
      )
      .map((u: any) => u.id);
  };

  // MODIFICADO: Solo obtener vendedores ACTIVOS del equipo
  const getVendorsByTeam = (teamName: string) => {
    // Buscar el gerente del equipo por nombre
    const manager = users.find(
      (u: any) =>
        u.role === "gerente" &&
        u.name.toLowerCase().includes(teamName.toLowerCase())
    );

    if (!manager) return [];

    // Obtener todos los descendientes del gerente
    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return users
      .filter(
        (u: any) =>
          u.role === "vendedor" && u.active && descendants.includes(u.id)
      )
      .map((u: any) => u.id);
  };

  const pickNextVendorId = (scopeUser?: any, botSource?: string) => {
    let pool: number[] = [];

    if (botSource && botConfig[botSource]) {
      const botConf = botConfig[botSource];
      if (botConf.targetTeam) {
        // Bot específico para un equipo - SOLO ACTIVOS
        pool = getVendorsByTeam(botConf.targetTeam);
      } else {
        // Bot 100 - distribución general - SOLO ACTIVOS
        pool = getActiveVendorIdsInScope(scopeUser || currentUser);
      }
    } else {
      // Asignación manual normal - SOLO ACTIVOS
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
  const pushAlertToChain = (
    vendorId: number,
    type: Alert["type"],
    message: string
  ) => {
    pushAlert(vendorId, type, message);
    const sup = users.find((u: any) => u.id === userById.get(vendorId)?.reportsTo);
    if (sup) pushAlert(sup.id, type, message);
    const gerente = sup ? users.find((u: any) => u.id === sup.reportsTo) : null;
    if (gerente) pushAlert(gerente.id, type, message);
  };

  // ===== Filtrados y ranking =====
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

  // ===== Nueva función para obtener ranking del equipo gerencial =====
  const getRankingByManagerialTeam = () => {
    if (!currentUser) return [];
    
    // Si es vendedor, buscar su gerente
    if (currentUser.role === "vendedor") {
      // Encontrar su supervisor
      const supervisor = userById.get(currentUser.reportsTo);
      if (!supervisor) return getRankingInScope(); // fallback
      
      // Encontrar el gerente del supervisor
      const gerente = userById.get(supervisor.reportsTo);
      if (!gerente) return getRankingInScope(); // fallback
      
      // Obtener todos los vendedores bajo este gerente
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
    
    // Para otros roles, usar el ranking normal en scope
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

  const getDashboardStats = (teamFilter?: string) => {
    const filteredLeads =
      teamFilter && teamFilter !== "todos"
        ? getFilteredLeadsByTeam(teamFilter)
        : getFilteredLeads();
    const vendidos = filteredLeads.filter((lead) => lead.estado === "vendido")
      .length;
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
        const sourceLeads = filteredLeads.filter(
          (lead) => lead.fuente === source
        );
        const vendidos = sourceLeads.filter(
          (lead) => lead.estado === "vendido"
        ).length;
        const conversion =
          sourceLeads.length > 0
            ? ((vendidos / sourceLeads.length) * 100).toFixed(1)
            : "0";
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
    created_by: L.created_by || null, // NUEVO
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

  // MODIFICADO: Función para actualizar estado de lead desde dashboard
  const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { estado: newStatus } as any);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, ...mapLeadFromApi(updated) } : l))
      );

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
  const [editingLeadObservaciones, setEditingLeadObservaciones] =
    useState<LeadRow | null>(null);
  const [viewingLeadHistorial, setViewingLeadHistorial] =
    useState<LeadRow | null>(null);

  const handleUpdateObservaciones = async (
    leadId: number,
    observaciones: string
  ) => {
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

  // NUEVAS: Funciones para manejar presupuesto y cotizador
  const handleUpdatePresupuesto = async (leadId: number, presupuesto: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { presupuesto } as any);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, presupuesto } : l))
      );
      setShowPresupuestoModal(false);
      setEditingLeadPresupuesto(null);
      addHistorialEntry(leadId, "Presupuesto Azofix actualizado");
    } catch (e) {
      console.error("No pude actualizar presupuesto del lead", e);
      alert("Error al actualizar presupuesto");
    }
  };

  const handleUpdateCotizador = async (leadId: number, cotizador: string) => {
    try {
      const updated = await apiUpdateLead(leadId, { cotizador } as any);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, cotizador } : l))
      );
      setShowCotizadorModal(false);
      setEditingLeadCotizador(null);
      addHistorialEntry(leadId, "Cotizador Azofix actualizado");
    } catch (e) {
      console.error("No pude actualizar cotizador del lead", e);
      alert("Error al actualizar cotizador");
    }
  };

  // MODIFICADO: Función para crear lead con "creado por" y asignación inteligente
  const handleCreateLead = async () => {
    try {
      console.log("Iniciando creación de lead...");
      
      const nombre = (document.getElementById("new-nombre") as HTMLInputElement)
        ?.value
        ?.trim();
      const telefono = (
        document.getElementById("new-telefono") as HTMLInputElement
      )?.value?.trim();
      const modelo = (document.getElementById("new-modelo") as HTMLInputElement)
        ?.value
        ?.trim();
      const formaPago = (document.getElementById("new-formaPago") as HTMLSelectElement)?.value;
      const infoUsado = (
        document.getElementById("new-infoUsado") as HTMLInputElement
      )?.value?.trim();
      const entrega = (document.getElementById("new-entrega") as HTMLInputElement)
        ?.checked;
      const fecha = (document.getElementById("new-fecha") as HTMLInputElement)
        ?.value;
      const autoAssign = (
        document.getElementById("new-autoassign") as HTMLInputElement
      )?.checked;
      const vendedorSelVal = (document.getElementById("new-vendedor") as HTMLSelectElement)
        ?.value;

      console.log("Datos del formulario:", { nombre, telefono, modelo, formaPago, infoUsado, entrega, fecha, autoAssign, vendedorSelVal });

      // Validaciones básicas
      if (!nombre || !telefono || !modelo) {
        alert("Por favor completa los campos obligatorios: Nombre, Teléfono y Modelo");
        return;
      }

      const vendedorIdSelRaw = parseInt(vendedorSelVal, 10);
      const vendedorIdSel = Number.isNaN(vendedorIdSelRaw)
        ? null
        : vendedorIdSelRaw;

      // MODIFICADO: Usar fuente "creado_por" para leads creados manualmente
      const fuente = "creado_por";

      // Asignación de vendedor
      let vendedorId: number | null = null;
      if (autoAssign) {
        console.log("Asignación automática activada");
        // MODIFICADO: Solo asignar automáticamente entre vendedores del scope del usuario actual
        vendedorId = pickNextVendorId(currentUser) ?? null;
        console.log("Vendedor asignado automáticamente:", vendedorId);
      } else {
        console.log("Asignación manual");
        // Verificar que el vendedor seleccionado esté activo y en el scope
        if (vendedorIdSel) {
          const selectedVendor = users.find(u => u.id === vendedorIdSel);
          const availableVendors = getAvailableVendorsForAssignment();
          console.log("Vendedor seleccionado:", selectedVendor);
          console.log("Vendedores disponibles:", availableVendors);
          
          if (selectedVendor && selectedVendor.active && availableVendors.some(v => v.id === vendedorIdSel)) {
            vendedorId = vendedorIdSel;
          } else {
            alert("El vendedor seleccionado no está disponible. Por favor selecciona otro vendedor o usa la asignación automática.");
            return;
          }
        } else {
          vendedorId = null;
        }
        console.log("Vendedor asignado manualmente:", vendedorId);
      }

      // Determinar equipo basado en el usuario actual o el vendedor asignado
      let equipo = 'roberto'; // Default
      
      if (vendedorId) {
        // Si hay vendedor asignado, determinar su equipo
        const vendedorAsignado = users.find(u => u.id === vendedorId);
        if (vendedorAsignado) {
          // Buscar el gerente del vendedor
          let currentUser = vendedorAsignado;
          while (currentUser && currentUser.reportsTo) {
            const manager = userById.get(currentUser.reportsTo);
            if (!manager) break;
            
            if (manager.role === 'gerente') {
              if (manager.name === 'Daniel Mottino') {
                equipo = 'daniel';
              } else if (manager.name === 'Roberto Sauer') {
                equipo = 'roberto';
              }
              break;
            }
            currentUser = manager;
          }
        }
      } else {
        // Si no hay vendedor, usar el equipo del usuario que está creando
        let currentUserForTeam = currentUser;
        while (currentUserForTeam && currentUserForTeam.reportsTo) {
          const manager = userById.get(currentUserForTeam.reportsTo);
          if (!manager) break;
          
          if (manager.role === 'gerente') {
            if (manager.name === 'Daniel Mottino') {
              equipo = 'daniel';
            } else if (manager.name === 'Roberto Sauer') {
              equipo = 'roberto';
            }
            break;
          }
          currentUserForTeam = manager;
        }
      }

      const leadData = {
        nombre,
        telefono,
        modelo,
        formaPago: formaPago || "Contado",
        notas: `Creado por: ${currentUser?.name}${infoUsado ? `\nInfo usado: ${infoUsado}` : ''}${entrega ? '\nEntrega usado: Sí' : ''}`,
        estado: "nuevo",
        fuente,
        fecha: fecha || new Date().toISOString().split('T')[0],
        vendedor: vendedorId, // El backend convertirá esto a assigned_to
        equipo: equipo, // NUEVO: Campo requerido por el backend
      };

      console.log("Datos a enviar al API:", leadData);

      const created = await apiCreateLead(leadData as any);
      console.log("Lead creado exitosamente:", created);
      
      const mapped = mapLeadFromApi(created);
      console.log("Lead mapeado:", mapped);
      
      if (mapped.vendedor) {
        pushAlert(
          mapped.vendedor,
          "lead_assigned",
          `Nuevo lead asignado: ${mapped.nombre} (creado por ${currentUser?.name})`
        );
      }
      
      setLeads((prev) => [mapped, ...prev]);
      setShowNewLeadModal(false);

      // Limpiar formulario
      (document.getElementById("new-nombre") as HTMLInputElement).value = "";
      (document.getElementById("new-telefono") as HTMLInputElement).value = "";
      (document.getElementById("new-modelo") as HTMLInputElement).value = "";
      (document.getElementById("new-infoUsado") as HTMLInputElement).value = "";
      (document.getElementById("new-fecha") as HTMLInputElement).value = "";
      (document.getElementById("new-entrega") as HTMLInputElement).checked = false;

      addHistorialEntry(mapped.id, `Creado por ${currentUser?.name}`);
      
      alert("Lead creado exitosamente");
      
    } catch (e: any) {
      console.error("Error completo al crear el lead:", e);
      console.error("Respuesta del error:", e?.response?.data);
      alert(`Error al crear el lead: ${e?.response?.data?.error || e?.message || 'Error desconocido'}`);
    }
  };

  // ===== Calendario (UI local) =====
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

  // ===== Gestión de Usuarios (API) =====
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [modalRole, setModalRole] = useState<
    "owner" | "director" | "gerente" | "supervisor" | "vendedor"
  >("vendedor");
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
    const roleToSet = availableRoles.includes(roleCurrent)
      ? roleCurrent
      : (availableRoles[0] as any);
    const validManagers = validManagersByRole(roleToSet);
    setModalRole(roleToSet as any);
    setModalReportsTo(
      roleToSet === "owner" ? null : u.reportsTo ?? validManagers[0]?.id ?? null
    );
    setShowUserModal(true);
  };

  // MODIFICADO: Asegurar que la contraseña se envíe correctamente al backend
  const saveUser = async () => {
    const name = (document.getElementById("u-name") as HTMLInputElement).value.trim();
    const email = (document.getElementById("u-email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("u-pass") as HTMLInputElement).value;
    const active = (document.getElementById("u-active") as HTMLInputElement).checked;

    if (!name || !email) {
      alert("Nombre y email son obligatorios");
      return;
    }
    
    // NUEVO: Validar contraseña para usuarios nuevos
    if (!editingUser && !password) {
      alert("La contraseña es obligatoria para usuarios nuevos");
      return;
    }

    const finalReportsTo = modalRole === "owner" ? null : modalReportsTo ?? null;

    try {
      if (editingUser) {
        const updateData: any = {
          name,
          email,
          role: modalRole,
          reportsTo: finalReportsTo,
          active: active ? 1 : 0,
        };
        
        // Solo incluir password si se proporcionó
        if (password && password.trim()) {
          updateData.password = password.trim();
        }

        const updated = await apiUpdateUser(editingUser.id, updateData);
        setUsers((prev) => prev.map((u: any) => (u.id === editingUser.id ? updated : u)));
      } else {
        const createData = {
          name,
          email,
          password: password.trim(), // MODIFICADO: Asegurar que se envíe la contraseña
          role: modalRole,
          reportsTo: finalReportsTo,
          active: active ? 1 : 0,
        };
        
        const created = await apiCreateUser(createData as any);
        setUsers((prev) => [...prev, created]);
      }
      setShowUserModal(false);
    } catch (e: any) {
      console.error("No pude guardar usuario", e);
      alert(`Error al ${editingUser ? 'actualizar' : 'crear'} usuario: ${e?.response?.data?.error || e.message}`);
    }
  };

  // ===== Función para abrir modal de confirmación de eliminación =====
  const openDeleteConfirm = (user: any) => {
    if (user.role === "owner") {
      alert("No podés eliminar al Dueño.");
      return;
    }
    
    const hasChildren = users.some((u: any) => u.reportsTo === user.id);
    if (hasChildren) {
      alert("No se puede eliminar: el usuario tiene integrantes a cargo. Primero reasigne o elimine a sus subordinados.");
      return;
    }

    const hasAssignedLeads = leads.some((l) => l.vendedor === user.id);
    if (hasAssignedLeads) {
      alert("No se puede eliminar: el usuario tiene leads asignados. Primero reasigne todos sus leads a otros vendedores.");
      return;
    }

    setUserToDelete(user);
    setShowDeleteConfirmModal(true);
  };

  // ===== Función para confirmar eliminación =====
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await apiDeleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u: any) => u.id !== userToDelete.id));
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    } catch (e) {
      console.error("No pude eliminar usuario", e);
      alert("Error al eliminar el usuario. Por favor, intenta nuevamente.");
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
            <p className="text-blue-300">
              {roles[currentUser?.role] || currentUser?.role}
            </p>
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
            ...(["director", "owner"].includes(currentUser?.role)
              ? [{ key: "plantillas", label: "Plantillas", Icon: BarChart3 }]
              : []),
            ...(canManageUsers()
              ? [{ key: "users", label: "Usuarios", Icon: Settings }]
              : []),
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
              <div className="flex items-center space-x-3">
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
                {/* NUEVO: Botón para crear lead si tiene permisos */}
                {canCreateLeads() && (
                  <button
                    onClick={() => setShowNewLeadModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus size={20} />
                    <span>Nuevo Lead</span>
                  </button>
                )}
              </div>
            </div>

            {/* Alerta si el usuario está desactivado */}
            {!currentUser?.active && (
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Bell className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-orange-700">
                      <strong>Usuario Desactivado:</strong> No recibirás nuevos leads automáticamente. 
                      Solo podrás gestionar los leads que ya tienes asignados.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Estadísticas principales */}
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
                          <p className="text-3xl font-bold text-gray-900">
                            {stats.totalLeads}
                          </p>
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
                          <p className="text-3xl font-bold text-green-600">
                            {stats.vendidos}
                          </p>
                        </div>
                        <div className="bg-green-500 p-3 rounded-full">
                          <Trophy className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">
                            Conversión
                          </p>
                          <p className="text-3xl font-bold text-purple-600">
                            {stats.conversion}%
                          </p>
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

            {/* MODIFICADO: Estados de Leads con posibilidad de editar estados */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Estados de Leads</h3>
                <div className="flex items-center space-x-2">
                  {["owner", "director"].includes(currentUser?.role) && (
                    <>
                      <span className="text-sm text-gray-600">Descargar Excel:</span>
                      <button
                        onClick={() => {
                          const teamFilter = ["owner", "director"].includes(currentUser?.role)
                            ? selectedTeam
                            : undefined;
                          const filteredLeads = teamFilter && teamFilter !== "todos"
                            ? getFilteredLeadsByTeam(teamFilter)
                            : getFilteredLeads();
                          downloadAllLeadsExcel(filteredLeads, userById, fuentes);
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center space-x-1"
                        title="Descargar Excel completo"
                      >
                        <Download size={12} />
                        <span>Todos</span>
                      </button>
                    </>
                  )}
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
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(estados).map(([key, estado]) => {
                  const teamFilter = ["owner", "director"].includes(currentUser?.role)
                    ? selectedTeam
                    : undefined;
                  const filteredLeads = teamFilter && teamFilter !== "todos"
                    ? getFilteredLeadsByTeam(teamFilter)
                    : getFilteredLeads();
                  const count = filteredLeads.filter((l) => l.estado === key).length;
                  const percentage = filteredLeads.length > 0 
                    ? ((count / filteredLeads.length) * 100).toFixed(1)
                    : "0";
                  
                  return (
                    <div key={key} className="relative group">
                      <button
                        onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                        className={`w-full text-center transition-all duration-200 transform hover:scale-105 ${
                          selectedEstado === key ? "ring-4 ring-blue-300 ring-opacity-50" : ""
                        }`}
                        title={`Ver todos los leads en estado: ${estado.label}`}
                      >
                        <div className={`${estado.color} text-white rounded-lg p-4 mb-2 relative cursor-pointer hover:opacity-90 transition-opacity`}>
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-xs opacity-75">{percentage}%</div>
                          
                          {/* Botón de descarga solo para owner y director */}
                          {["owner", "director"].includes(currentUser?.role) && count > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const teamFilter = ["owner", "director"].includes(currentUser?.role)
                                  ? selectedTeam
                                  : undefined;
                                const filteredLeads = teamFilter && teamFilter !== "todos"
                                  ? getFilteredLeadsByTeam(teamFilter)
                                  : getFilteredLeads();
                                downloadLeadsByStateExcel(filteredLeads, key, userById, fuentes);
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

              {/* MODIFICADO: Lista filtrada con edición de estados */}
              {selectedEstado && (
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">
                    Leads en estado:{" "}
                    <span
                      className={`px-3 py-1 rounded-full text-white text-sm ${
                        estados[selectedEstado].color
                      }`}
                    >
                      {estados[selectedEstado].label}
                    </span>
                  </h4>

                  {(() => {
                    const teamFilter = ["owner", "director"].includes(currentUser?.role)
                      ? selectedTeam
                      : undefined;
                    const filteredLeads = teamFilter && teamFilter !== "todos"
                      ? getFilteredLeadsByTeam(teamFilter)
                      : getFilteredLeads();
                    const leadsFiltrados = filteredLeads.filter(
                      (l) => l.estado === selectedEstado
                    );

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
                                Estado
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
                              const vendedor = lead.vendedor
                                ? userById.get(lead.vendedor)
                                : null;
                              const canReassign =
                                canManageUsers() ||
                                (currentUser?.role === "supervisor" &&
                                  lead.vendedor &&
                                  getVisibleUsers().some((u: any) => u.id === lead.vendedor));
                              
                              return (
                                <tr key={lead.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2">
                                    <div className="font-medium text-gray-900">
                                      {lead.nombre}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center space-x-1">
                                      <Phone size={12} className="text-gray-400" />
                                      <span className="text-gray-700">{lead.telefono}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {lead.modelo}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {lead.formaPago}
                                      </div>
                                      {lead.infoUsado && (
                                        <div className="text-xs text-orange-600">
                                          Usado: {lead.infoUsado}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    {/* NUEVO: Select editable para cambiar estado */}
                                    <select
                                      value={lead.estado}
                                      onChange={(e) =>
                                        handleUpdateLeadStatus(lead.id, e.target.value)
                                      }
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
                                    <div>
                                      {vendedor?.name || "Sin asignar"}
                                      {vendedor && !vendedor.active && (
                                        <div className="text-xs text-red-600">
                                          (Desactivado)
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-gray-500 text-xs">
                                    {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <div className="flex items-center justify-center space-x-1">
                                      {/* NUEVO: Botón de WhatsApp */}
                                      <button
                                        onClick={() => {
                                          const phoneNumber = lead.telefono.replace(/\D/g, '');
                                          const message = encodeURIComponent(generateWhatsAppMessage(lead));
                                          const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                                          window.open(whatsappUrl, '_blank');
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center space-x-1"
                                        title="Chatear por WhatsApp"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
                                        </svg>
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingLeadPresupuesto(lead);
                                          setShowPresupuestoModal(true);
                                        }}
                                        className={`px-2 py-1 text-xs rounded ${
                                          lead.presupuesto && lead.presupuesto.trim()
                                            ? "bg-orange-200 text-orange-800"
                                            : "bg-orange-100 text-orange-700"
                                        } hover:bg-orange-200`}
                                        title="Gestionar presupuesto Azofix"
                                      >
                                        {lead.presupuesto && lead.presupuesto.trim() ? "💰" : "$"}
                                      </button>

                                      {/* NUEVO: Botón de Cotizador Avanzado */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLeadParaCotizar(lead);
                                          setShowCotizadorAvanzadoModal(true);
                                          // Pre-llenar con datos del lead
                                          setSelectedMarca("");
                                          setSelectedModelo("");
                                          setSelectedConfig('basico');
                                          setSelectedPlan("plan_36");
                                        }}
                                        className={`px-2 py-1 text-xs rounded ${
                                          lead.cotizador && lead.cotizador.trim()
                                            ? "bg-purple-200 text-purple-800"
                                            : "bg-purple-100 text-purple-700"
                                        } hover:bg-purple-200`}
                                        title="Cotizador automático"
                                      >
                                        {lead.cotizador && lead.cotizador.trim() ? "📊" : "🧮"}
                                      </button>
                                      
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

            {/* Métricas por fuente */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Performance por Fuente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const teamFilter = ["owner", "director"].includes(currentUser?.role)
                    ? selectedTeam
                    : undefined;
                  return getSourceMetrics(teamFilter).map((item) => (
                    <div key={item.source} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
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
                          <span className="font-semibold text-purple-600">
                            {item.conversion}%
                          </span>
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
              {/* MODIFICADO: Mostrar botón solo si puede crear leads */}
              {canCreateLeads() && (
                <button
                  onClick={() => setShowNewLeadModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Lead</span>
                </button>
              )}
            </div>

            {/* Barra de búsqueda y filtros */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Búsqueda de texto */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, teléfono, modelo, vendedor, observaciones..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Botón para mostrar/ocultar filtros */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
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
                      className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      <X size={16} />
                      <span>Limpiar</span>
                    </button>
                  )}

                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{getFilteredAndSearchedLeads().length}</span> leads encontrados
                  </div>
                </div>
              </div>

              {/* Panel de filtros expandible */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Filtro por vendedor */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <User size={16} className="inline mr-1" />
                        Vendedor
                      </label>
                      <select
                        value={selectedVendedorFilter || ""}
                        onChange={(e) => setSelectedVendedorFilter(e.target.value ? parseInt(e.target.value, 10) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos los vendedores</option>
                        <option value="0">Sin asignar</option>
                        {getVisibleUsers()
                          .filter((u: any) => u.role === "vendedor")
                          .map((vendedor: any) => {
                            const leadsCount = leads.filter(l => l.vendedor === vendedor.id).length;
                            return (
                              <option key={vendedor.id} value={vendedor.id}>
                                {vendedor.name} ({leadsCount} leads) {!vendedor.active ? " - Inactivo" : ""}
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    {/* Filtro por estado */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estado
                      </label>
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

                    {/* Filtro por fuente */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fuente
                      </label>
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

            {/* Tabla de leads con búsqueda y filtros aplicados */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Contacto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Vehículo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fuente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Vendedor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredAndSearchedLeads().length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          {searchText.trim() || selectedVendedorFilter || selectedEstadoFilter || selectedFuenteFilter
                            ? "No se encontraron leads que coincidan con los filtros aplicados"
                            : "No hay leads para mostrar"}
                        </td>
                      </tr>
                    ) : (
                      getFilteredAndSearchedLeads().map((lead) => {
                        const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
                        const canReassign =
                          canManageUsers() ||
                          (currentUser?.role === "supervisor" &&
                            lead.vendedor &&
                            getVisibleUsers().some((u: any) => u.id === lead.vendedor));

                        return (
                          <tr key={lead.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <div className="font-medium text-gray-900">{lead.nombre}</div>
                              {/* NUEVO: Mostrar quién creó el lead */}
                              {lead.created_by && (
                                <div className="text-xs text-gray-500">
                                  Creado por: {userById.get(lead.created_by)?.name || 'Usuario eliminado'}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center space-x-1">
                                <Phone size={12} className="text-gray-400" />
                                <span className="text-gray-700">{lead.telefono}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
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
                            <td className="px-4 py-4">
                              <select
                                value={lead.estado}
                                onChange={(e) =>
                                  handleUpdateLeadStatus(lead.id, e.target.value)
                                }
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
                              <div className="flex items-center space-x-1">
                                <span className="text-sm">
                                  {fuentes[lead.fuente as string]?.icon || "❓"}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {fuentes[lead.fuente as string]?.label || String(lead.fuente)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-700">
                              <div>
                                {vendedor?.name || "Sin asignar"}
                                {vendedor && !vendedor.active && (
                                  <div className="text-xs text-red-600">
                                    (Desactivado)
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-500 text-xs">
                              {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                            </td>
                              <td className="px-4 py-4 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  {/* NUEVO: Botón de WhatsApp */}
                                  <button
                                    onClick={() => {
                                      const phoneNumber = lead.telefono.replace(/\D/g, ''); // Quitar caracteres no numéricos
                                      const message = encodeURIComponent(
                                        `Hola ${lead.nombre}, me contacto desde Grupo alra por su consulta sobre el vehiculo ${lead.modelo}. ¿Cómo se encuentra?`
                                      );
                                      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                                      window.open(whatsappUrl, '_blank');
                                    }}
                                    className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center space-x-1"
                                    title="Chatear por WhatsApp"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
                                    </svg>
                                  </button>
                                  
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
              <div className="flex items-center space-x-3">
                <select
                  value={selectedCalendarUserId ?? ""}
                  onChange={(e) =>
                    setSelectedCalendarUserId(
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
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
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Evento</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Próximos eventos -{" "}
                {selectedCalendarUserId
                  ? userById.get(selectedCalendarUserId)?.name
                  : "Mi calendario"}
              </h3>

              {eventsForSelectedUser.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No hay eventos programados
                </p>
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
              {/* Ranking General - Solo para Owner */}
              {isOwner() && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    Ranking General
                  </h3>
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
                            <p className="font-medium text-gray-900">
                              {vendedor.nombre}
                            </p>
                            <p className="text-xs text-gray-500">{vendedor.team}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            {vendedor.ventas} ventas
                          </p>
                          <p className="text-xs text-gray-500">
                            {vendedor.leadsAsignados} leads asignados
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {getRanking().length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      No hay vendedores registrados
                    </p>
                  )}
                </div>
              )}

              {/* Ranking en Mi Scope / Vendedores de la misma gerencia */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  {currentUser?.role === "vendedor" 
                    ? "Ranking Vendedores" 
                    : isOwner() 
                    ? "Mi Scope" 
                    : "Ranking"}
                </h3>
                <div className="space-y-3">
                  {(currentUser?.role === "vendedor" 
                    ? getRankingByManagerialTeam() 
                    : getRankingInScope()
                  ).map((vendedor, index) => (
                    <div
                      key={vendedor.id}
                      className={`flex items-center justify-between p-4 border border-gray-200 rounded-lg ${
                        vendedor.id === currentUser?.id ? "bg-blue-50 border-blue-300" : ""
                      }`}
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
                          <p className={`font-medium ${
                            vendedor.id === currentUser?.id ? "text-blue-900" : "text-gray-900"
                          }`}>
                            {vendedor.nombre}
                            {vendedor.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-blue-600 font-normal">(Tú)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{vendedor.team}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          {vendedor.ventas} ventas
                        </p>
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
                {(currentUser?.role === "vendedor" 
                  ? getRankingByManagerialTeam() 
                  : getRankingInScope()
                ).length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    {currentUser?.role === "vendedor" 
                      ? "No hay otros vendedores en tu gerencia"
                      : "No hay vendedores en tu scope"}
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

              {/* Estadísticas por estado tipo dashboard */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Estados de Leads - Mi Equipo
                  </h3>
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
                      Leads de mi equipo en estado:{" "}
                      <span
                        className={`px-3 py-1 rounded-full text-white text-sm ${
                          estados[selectedEstado].color
                        }`}
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
                      const leadsFiltrados = filteredLeads.filter(
                        (l) => l.estado === selectedEstado
                      );

                      if (leadsFiltrados.length === 0) {
                        return (
                          <p className="text-gray-500 text-center py-8">
                            No hay leads de tu equipo en estado "
                            {estados[selectedEstado].label}"
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
                                  Estado
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
                                const vendedor = lead.vendedor
                                  ? userById.get(lead.vendedor)
                                  : null;
                                return (
                                  <tr key={lead.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2">
                                      <div className="font-medium text-gray-900">
                                        {lead.nombre}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center space-x-1">
                                        <Phone size={12} className="text-gray-400" />
                                        <span className="text-gray-700">{lead.telefono}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div>
                                        <div className="font-medium text-gray-900">
                                          {lead.modelo}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {lead.formaPago}
                                        </div>
                                        {lead.infoUsado && (
                                          <div className="text-xs text-orange-600">
                                            Usado: {lead.infoUsado}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      {/* NUEVO: Select editable en equipo también */}
                                      <select
                                        value={lead.estado}
                                        onChange={(e) =>
                                          handleUpdateLeadStatus(lead.id, e.target.value)
                                        }
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
                                        {/* NUEVO: Botón de WhatsApp */}
                                        <button
                                          onClick={() => {
                                            const phoneNumber = lead.telefono.replace(/\D/g, '');
                                            const message = encodeURIComponent(generateWhatsAppMessage(lead));
                                            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
                                            window.open(whatsappUrl, '_blank');
                                          }}
                                          className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center space-x-1"
                                          title="Chatear por WhatsApp"
                                        >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.587"/>
                                          </svg>
                                        </button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLeadPresupuesto(lead);
                                            setShowPresupuestoModal(true);
                                          }}
                                          className={`px-2 py-1 text-xs rounded ${
                                            lead.presupuesto && lead.presupuesto.trim()
                                              ? "bg-orange-200 text-orange-800"
                                              : "bg-orange-100 text-orange-700"
                                          } hover:bg-orange-200`}
                                          title="Gestionar presupuesto Azofix"
                                        >
                                          {lead.presupuesto && lead.presupuesto.trim() ? "💰" : "$"}
                                        </button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLeadCotizador(lead);
                                            setShowCotizadorModal(true);
                                          }}
                                          className={`px-2 py-1 text-xs rounded ${
                                            lead.cotizador && lead.cotizador.trim()
                                              ? "bg-purple-200 text-purple-800"
                                              : "bg-purple-100 text-purple-700"
                                          } hover:bg-purple-200`}
                                          title="Gestionar cotizador Azofix"
                                        >
                                          {lead.cotizador && lead.cotizador.trim() ? "📊" : "📋"}
                                        </button>
                                        
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
                                        {(canManageUsers() ||
                                          (currentUser?.role === "supervisor" &&
                                            lead.vendedor &&
                                            getVisibleUsers().some(
                                              (u: any) => u.id === lead.vendedor
                                            ))) && (
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
                          <p className="font-medium text-gray-900">
                            {vendedor.nombre}
                          </p>
                          <p className="text-xs text-gray-500">{vendedor.team}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          {vendedor.ventas} ventas
                        </p>
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
                  <p className="text-gray-500 text-center py-8">
                    No hay vendedores en tu equipo
                  </p>
                )}
              </div>
            </div>
          )}

        {/* Sección Usuarios */}
        {activeSection === "users" && canManageUsers() && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h2>
              {/* MODIFICADO: Solo mostrar botón si puede crear usuarios */}
              {canCreateUsers() && (
                <button
                  onClick={openCreateUser}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={20} />
                  <span>Nuevo Usuario</span>
                </button>
              )}
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
                              {roles[user.role] || user.role}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            {manager?.name || "—"}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  user.active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
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
                              <div className="text-xs text-orange-600 mt-1">
                                No recibe leads nuevos
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {user.role === "vendedor" ? (
                              <div className="text-sm">
                                <div>{userLeads.length} leads</div>
                                <div className="text-green-600 font-medium">
                                  {userSales} ventas
                                </div>
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
          </div>
        )}

        {/* Sección Plantillas de Presupuestos */}
        {activeSection === "plantillas" && ["director", "owner"].includes(currentUser?.role) && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Gestión de Plantillas de Presupuestos</h2>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-800">Plantillas de Presupuestos</h3>
                  <button
                    onClick={() => setShowCrearPlantillaModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={20} />
                    <span>Nueva Plantilla</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plantillasLocal.filter(p => p.active).map(plantilla => (
                    <div key={plantilla.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-800">
                          {plantilla.marca} {plantilla.modelo} {plantilla.anio}
                        </h4>
                        <button
                          onClick={() => {
                            setPlantillaSeleccionada(plantilla);
                            setShowCrearPlantillaModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                      
                      <div className="text-lg font-bold text-green-600 mb-2">
                        ${plantilla.precio_base.toLocaleString('es-AR')}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Incluye {plantilla.incluye.length} items</div>
                        {plantilla.financiacion_disponible && (
                          <div className="text-blue-600">
                            Financiación: {plantilla.cuotas_minimas}-{plantilla.cuotas_maximas} cuotas
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Creado por: {userById.get(plantilla.created_by)?.name || 'Sistema'}</span>
                          <button
                            onClick={() => {
                              setPlantillasLocal(prev => 
                                prev.map(p => 
                                  p.id === plantilla.id ? {...p, active: false} : p
                                )
                              );
                            }}
                            className="text-red-500 hover:text-red-700"
                            title="Desactivar plantilla"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {plantillasLocal.filter(p => p.active).length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-4">📋</div>
                    <p>No hay plantillas de presupuestos creadas</p>
                    <p className="text-sm mt-2">Crea la primera plantilla para automatizar los presupuestos</p>
                  </div>
                )}
              </div>
            </div>

            {/* Información sobre el funcionamiento */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-blue-800 mb-3">Cómo funciona el sistema de presupuestos</h4>
              <div className="space-y-2 text-sm text-blue-700">
                <div className="flex items-start space-x-2">
                  <span className="font-bold">1.</span>
                  <span>Creas plantillas de presupuestos para cada modelo de vehículo</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="font-bold">2.</span>
                  <span>Cuando un vendedor presiona el botón de presupuesto en un lead:</span>
                </div>
                <div className="ml-6 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span>⚡</span>
                    <span>Si detecta el modelo automáticamente → genera presupuesto al instante</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>$</span>
                    <span>Si no encuentra coincidencia → abre modal para selección manual</span>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="font-bold">3.</span>
                  <span>El presupuesto se envía automáticamente via WhatsApp con toda la información</span>
                </div>
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
                  setAlerts((prev) =>
                    prev.map((a) =>
                      a.userId === currentUser?.id ? { ...a, read: true } : a
                    )
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
                    .sort(
                      (a, b) =>
                        new Date(b.ts).getTime() - new Date(a.ts).getTime()
                    )
                    .map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 border rounded-lg ${
                          alert.read
                            ? "border-gray-200 bg-gray-50"
                            : "border-blue-200 bg-blue-50"
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
                                  prev.map((a) =>
                                    a.id === alert.id ? { ...a, read: true } : a
                                  )
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

        {/* NUEVO: Modal para crear/editar plantillas de presupuestos */}
        {showCrearPlantillaModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  {plantillaSeleccionada ? "Editar Plantilla" : "Nueva Plantilla de Presupuesto"}
                </h3>
                <button
                  onClick={() => {
                    setShowCrearPlantillaModal(false);
                    setPlantillaSeleccionada(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Información básica del vehículo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
                    <input
                      type="text"
                      id="plantilla-marca"
                      defaultValue={plantillaSeleccionada?.marca || ""}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Volkswagen"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
                    <input
                      type="text"
                      id="plantilla-modelo"
                      defaultValue={plantillaSeleccionada?.modelo || ""}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Gol"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Año *</label>
                    <input
                      type="number"
                      id="plantilla-anio"
                      defaultValue={plantillaSeleccionada?.anio || new Date().getFullYear()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Precio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Base *</label>
                  <input
                    type="number"
                    id="plantilla-precio"
                    defaultValue={plantillaSeleccionada?.precio_base || ""}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="4500000"
                  />
                </div>

                {/* Qué incluye */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qué incluye (uno por línea)</label>
                  <textarea
                    id="plantilla-incluye"
                    defaultValue={plantillaSeleccionada?.incluye.join('\n') || "Seguro por 6 meses\nPatentamiento incluido\nTransferencia gratuita\nGarantía oficial 3 años"}
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Cada línea será un bullet point en el presupuesto"
                  />
                </div>

                {/* Financiación */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="plantilla-financiacion"
                      defaultChecked={plantillaSeleccionada?.financiacion_disponible ?? true}
                      className="text-blue-600"
                    />
                    <label htmlFor="plantilla-financiacion" className="text-sm font-medium text-gray-700">
                      Financiación disponible
                    </label>
                  </div>

                  <div className="ml-6 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Cuotas mínimas</label>
                      <input
                        type="number"
                        id="plantilla-cuotas-min"
                        defaultValue={plantillaSeleccionada?.cuotas_minimas || 12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Cuotas máximas</label>
                      <input
                        type="number"
                        id="plantilla-cuotas-max"
                        defaultValue={plantillaSeleccionada?.cuotas_maximas || 60}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Enganche mínimo (%)</label>
                      <input
                        type="number"
                        id="plantilla-enganche"
                        defaultValue={plantillaSeleccionada?.enganche_minimo || 20}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Descripción adicional */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Información adicional</label>
                  <textarea
                    id="plantilla-descripcion"
                    defaultValue={plantillaSeleccionada?.descripcion_adicional || ""}
                    className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Vehículo 0km con entrega inmediata. Incluye service gratuito por 12 meses."
                  />
                </div>

                {/* Vista previa */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Vista Previa del Presupuesto</h4>
                  <div className="text-sm text-gray-700 whitespace-pre-line bg-white p-3 rounded border">
                    {/* Aquí se mostraría la vista previa en tiempo real */}
                    🚗 PRESUPUESTO VOLKSWAGEN GOL 2024
                    
                    👋 Hola [Cliente], te envío el presupuesto solicitado:
                    
                    💰 Precio: $4.500.000
                    
                    ✅ Incluye:
                    • Seguro por 6 meses
                    • Patentamiento incluido
                    • Transferencia gratuita
                    • Garantía oficial 3 años
                    
                    💳 Financiación disponible:
                    • Desde 12 hasta 60 cuotas
                    • Enganche mínimo: 20%
                    • Cuota estimada: $100.000 (36 cuotas)
                    
                    ⏰ Presupuesto válido por 7 días
                    📞 ¿Te interesa? ¡Coordinemos una reunión!
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      // Obtener valores del formulario
                      const marca = (document.getElementById("plantilla-marca") as HTMLInputElement).value.trim();
                      const modelo = (document.getElementById("plantilla-modelo") as HTMLInputElement).value.trim();
                      const anio = parseInt((document.getElementById("plantilla-anio") as HTMLInputElement).value);
                      const precio = parseInt((document.getElementById("plantilla-precio") as HTMLInputElement).value);
                      const incluye = (document.getElementById("plantilla-incluye") as HTMLTextAreaElement).value
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0);
                      const financiacion = (document.getElementById("plantilla-financiacion") as HTMLInputElement).checked;
                      const cuotasMin = parseInt((document.getElementById("plantilla-cuotas-min") as HTMLInputElement).value);
                      const cuotasMax = parseInt((document.getElementById("plantilla-cuotas-max") as HTMLInputElement).value);
                      const enganche = parseInt((document.getElementById("plantilla-enganche") as HTMLInputElement).value);
                      const descripcion = (document.getElementById("plantilla-descripcion") as HTMLTextAreaElement).value.trim();

                      if (!marca || !modelo || !precio) {
                        alert("Por favor completa los campos obligatorios (marca, modelo, precio)");
                        return;
                      }

                      const nuevaPlantilla: PlantillaPresupuesto = {
                        id: plantillaSeleccionada?.id || `${marca.toLowerCase()}_${modelo.toLowerCase()}_${anio}`,
                        marca,
                        modelo,
                        anio,
                        precio_base: precio,
                        incluye,
                        financiacion_disponible: financiacion,
                        cuotas_minimas: cuotasMin,
                        cuotas_maximas: cuotasMax,
                        enganche_minimo: enganche,
                        descripcion_adicional: descripcion,
                        created_by: currentUser?.id || 1,
                        created_at: plantillaSeleccionada?.created_at || new Date().toISOString(),
                        active: true
                      };

                      if (plantillaSeleccionada) {
                        // Actualizar existente
                        setPlantillasLocal(prev => 
                          prev.map(p => p.id === plantillaSeleccionada.id ? nuevaPlantilla : p)
                        );
                      } else {
                        // Agregar nueva
                        setPlantillasLocal(prev => [...prev, nuevaPlantilla]);
                      }

                      setShowCrearPlantillaModal(false);
                      setPlantillaSeleccionada(null);
                      alert(`Plantilla ${plantillaSeleccionada ? 'actualizada' : 'creada'} correctamente`);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    {plantillaSeleccionada ? "Actualizar Plantilla" : "Crear Plantilla"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCrearPlantillaModal(false);
                      setPlantillaSeleccionada(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODALES EXISTENTES... */}
        
        {/* Modal de Confirmación para Eliminar Usuario */}
        {showDeleteConfirmModal && userToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center mb-6">
                <div className="bg-red-100 p-3 rounded-full mr-4">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Confirmar Eliminación
                  </h3>
                  <p className="text-sm text-gray-600">
                    Esta acción no se puede deshacer
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-800 mb-2">Usuario a eliminar:</h4>
                <div className="text-sm space-y-1">
                  <div><strong>Nombre:</strong> {userToDelete.name}</div>
                  <div><strong>Email:</strong> {userToDelete.email}</div>
                  <div><strong>Rol:</strong> {roles[userToDelete.role] || userToDelete.role}</div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Bell className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800">
                      Atención - Eliminación Permanente
                    </h4>
                    <div className="mt-2 text-sm text-red-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Se eliminará permanentemente del sistema</li>
                        <li>Se perderá acceso a todas las funcionalidades</li>
                        <li>No podrá recuperar su cuenta</li>
                        <li>Los datos históricos se mantendrán para auditoría</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
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

        {/* Modal: Reasignación de Lead */}
        {showReassignModal && leadToReassign && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Reasignar Lead - {leadToReassign.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowReassignModal(false);
                    setLeadToReassign(null);
                    setSelectedVendorForReassign(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="mb-6">
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">Información del Lead</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Cliente:</span>{" "}
                      {leadToReassign.nombre}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Teléfono:</span>{" "}
                      {leadToReassign.telefono}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Vehículo:</span>{" "}
                      {leadToReassign.modelo}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Estado:</span>
                      <span
                        className={`ml-2 px-2 py-1 rounded-full text-xs font-medium text-white ${estados[leadToReassign.estado].color}`}
                      >
                        {estados[leadToReassign.estado].label}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Fuente:</span>
                      <span className="ml-2">
                        {fuentes[leadToReassign.fuente as string]?.icon || "❓"}{" "}
                        {fuentes[leadToReassign.fuente as string]?.label ||
                          String(leadToReassign.fuente)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Vendedor actual:</span>{" "}
                      {leadToReassign.vendedor
                        ? userById.get(leadToReassign.vendedor)?.name
                        : "Sin asignar"}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Seleccionar nuevo vendedor (solo vendedores activos)
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {/* Opción para no asignar */}
                    <div
                      onClick={() => setSelectedVendorForReassign(null)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedVendorForReassign === null
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">--</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Sin asignar</p>
                            <p className="text-sm text-gray-500">
                              Dejar el lead sin vendedor asignado
                            </p>
                          </div>
                        </div>
                        {selectedVendorForReassign === null && (
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lista de vendedores disponibles - SOLO ACTIVOS */}
                    {getAvailableVendorsForReassign().map((vendedor: any) => {
                      const vendedorLeads = leads.filter((l) => l.vendedor === vendedor.id);
                      const vendedorVentas = vendedorLeads.filter(
                        (l) => l.estado === "vendido"
                      ).length;
                      const conversion =
                        vendedorLeads.length > 0
                          ? ((vendedorVentas / vendedorLeads.length) * 100).toFixed(0)
                          : "0";

                      return (
                        <div
                          key={vendedor.id}
                          onClick={() => setSelectedVendorForReassign(vendedor.id)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedVendorForReassign === vendedor.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                  {vendedor.name
                                    .split(" ")
                                    .map((n: string) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .substring(0, 2)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{vendedor.name}</p>
                                <p className="text-sm text-gray-500">
                                  {vendedorLeads.length} leads • {vendedorVentas} ventas •{" "}
                                  {conversion}% conversión
                                </p>
                                <p className="text-xs text-gray-400">
                                  Equipo de {userById.get(vendedor.reportsTo)?.name || "—"}
                                </p>
                                <p className="text-xs text-green-600 font-medium">
                                  ✓ Activo - Recibe leads nuevos
                                </p>
                              </div>
                            </div>
                            {selectedVendorForReassign === vendedor.id && (
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {getAvailableVendorsForReassign().length === 0 && (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border">
                      <p className="text-gray-500">
                        No hay vendedores activos disponibles en tu scope para reasignar
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleReassignLead}
                  disabled={selectedVendorForReassign === leadToReassign.vendedor}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                    selectedVendorForReassign === leadToReassign.vendedor
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {selectedVendorForReassign === leadToReassign.vendedor
                    ? "Ya está asignado a este vendedor"
                    : "Reasignar Lead"}
                </button>
                <button
                  onClick={() => {
                    setShowReassignModal(false);
                    setLeadToReassign(null);
                    setSelectedVendorForReassign(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NUEVO: Modal Cotizador Avanzado (estilo Azofix) */}
        {showCotizadorAvanzadoModal && leadParaCotizar && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  🧮 Cotizador Automático - {leadParaCotizar.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowCotizadorAvanzadoModal(false);
                    setLeadParaCotizar(null);
                    setCotizacionActual(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Panel de Configuración */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800">Configuración del Vehículo</h4>
                  
                  {/* Selección de Marca y Modelo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                      <select
                        value={selectedMarca}
                        onChange={(e) => {
                          setSelectedMarca(e.target.value);
                          setSelectedModelo(""); // Reset modelo
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Seleccionar marca</option>
                        {[...new Set(vehiculosDB.map(v => v.marca))].map(marca => (
                          <option key={marca} value={marca}>{marca}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                      <select
                        value={selectedModelo}
                        onChange={(e) => setSelectedModelo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        disabled={!selectedMarca}
                      >
                        <option value="">Seleccionar modelo</option>
                        {vehiculosDB
                          .filter(v => v.marca === selectedMarca)
                          .map(vehiculo => (
                            <option key={vehiculo.modelo} value={vehiculo.modelo}>
                              {vehiculo.modelo}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Configuración */}
                  {selectedModelo && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Configuración</label>
                      <div className="space-y-2">
                        {Object.entries(vehiculosDB.find(v => v.marca === selectedMarca && v.modelo === selectedModelo)?.configuraciones || {}).map(([key, config]) => (
                          <label key={key} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                            <input
                              type="radio"
                              name="configuracion"
                              value={key}
                              checked={selectedConfig === key}
                              onChange={(e) => setSelectedConfig(e.target.value as 'basico' | 'intermedio' | 'full')}
                              className="text-purple-600"
                            />
                            <div className="flex-1">
                              <div className="font-medium capitalize">{key}</div>
                              <div className="text-sm text-gray-600">{config.descripcion}</div>
                              <div className="text-sm font-semibold text-green-600">
                                ${config.precio.toLocaleString('es-AR')}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Plan de Financiación */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plan de Financiación</label>
                    <select
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {planesFinanciacion.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          {plan.nombre} - {plan.cuotas} cuotas (Tasa: {(plan.tasa_mensual * 100).toFixed(1)}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Opciones adicionales */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800">Opciones de Descuento</h5>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={esContado}
                        onChange={(e) => setEsContado(e.target.checked)}
                        className="text-purple-600"
                      />
                      <span className="text-sm">Pago contado (5% desc.)</span>
                    </label>

                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={esClienteNuevo}
                        onChange={(e) => setEsClienteNuevo(e.target.checked)}
                        className="text-purple-600"
                      />
                      <span className="text-sm">Cliente nuevo (3% desc.)</span>
                    </label>

                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={tieneUsado}
                        onChange={(e) => setTieneUsado(e.target.checked)}
                        className="text-purple-600"
                      />
                      <span className="text-sm">Entrega vehículo usado (2% desc. + valor del usado)</span>
                    </label>

                    {tieneUsado && (
                      <div className="ml-6 space-y-2 p-3 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Marca"
                            value={usadoMarca}
                            onChange={(e) => setUsadoMarca(e.target.value)}
                            className="px-2 py-1 border rounded text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Modelo"
                            value={usadoModelo}
                            onChange={(e) => setUsadoModelo(e.target.value)}
                            className="px-2 py-1 border rounded text-sm"
                          />
                          <input
                            type="number"
                            placeholder="Año"
                            value={usadoAnio}
                            onChange={(e) => setUsadoAnio(parseInt(e.target.value))}
                            className="px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        {usadoMarca && usadoModelo && usadoAnio && (
                          <div className="text-sm font-medium text-green-600">
                            Valor estimado: ${calcularValorUsado(usadoMarca, usadoModelo, usadoAnio).toLocaleString('es-AR')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Botón para generar cotización */}
                  <button
                    onClick={() => {
                      if (selectedMarca && selectedModelo && selectedPlan) {
                        const condiciones = {
                          contado: esContado,
                          cliente_nuevo: esClienteNuevo,
                          entrega_usado: tieneUsado,
                          marca_usado: usadoMarca,
                          modelo_usado: usadoModelo,
                          anio_usado: usadoAnio,
                          enganche: montoEnganche
                        };
                        
                        const cotizacion = generarCotizacion(
                          selectedMarca,
                          selectedModelo,
                          selectedConfig,
                          selectedPlan,
                          condiciones
                        );
                        
                        setCotizacionActual(cotizacion);
                      }
                    }}
                    disabled={!selectedMarca || !selectedModelo || !selectedPlan}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium"
                  >
                    🧮 Generar Cotización
                  </button>
                </div>

                {/* Panel de Resultados */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800">Cotización Generada</h4>
                  
                  {cotizacionActual ? (
                    <div className="space-y-4">
                      {/* Resumen del vehículo */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 className="font-semibold text-blue-800 mb-2">
                          🚗 {cotizacionActual.vehiculo.marca} {cotizacionActual.vehiculo.modelo} {cotizacionActual.vehiculo.anio}
                        </h5>
                        <p className="text-sm text-blue-700 mb-1">
                          Configuración: {cotizacionActual.configuracion.charAt(0).toUpperCase() + cotizacionActual.configuracion.slice(1)}
                        </p>
                        <p className="text-sm text-blue-700">
                          {cotizacionActual.vehiculo.configuraciones[cotizacionActual.configuracion].descripcion}
                        </p>
                      </div>

                      {/* Cálculos de precio */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h5 className="font-semibold text-green-800 mb-3">💰 Desglose de Precios</h5>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Precio base:</span>
                            <span>${cotizacionActual.vehiculo.configuraciones[cotizacionActual.configuracion].precio.toLocaleString('es-AR')}</span>
                          </div>
                          
                          {cotizacionActual.descuentos.map((desc, index) => (
                            <div key={index} className="flex justify-between text-green-700">
                              <span>{desc.descripcion}:</span>
                              <span>-{(desc.porcentaje * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                          
                          {cotizacionActual.vehiculo_usado && (
                            <div className="flex justify-between text-orange-700">
                              <span>Valor vehículo usado ({cotizacionActual.vehiculo_usado.marca} {cotizacionActual.vehiculo_usado.modelo}):</span>
                              <span>-${cotizacionActual.vehiculo_usado.valor_estimado.toLocaleString('es-AR')}</span>
                            </div>
                          )}
                          
                          <div className="border-t pt-2 flex justify-between font-bold text-green-800">
                            <span>TOTAL FINAL:</span>
                            <span>${cotizacionActual.total_final.toLocaleString('es-AR')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Plan de financiación */}
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h5 className="font-semibold text-purple-800 mb-3">📅 {cotizacionActual.plan_financiacion.nombre}</h5>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Cuotas:</span>
                            <span>{cotizacionActual.plan_financiacion.cuotas}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tasa mensual:</span>
                            <span>{(cotizacionActual.plan_financiacion.tasa_mensual * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between font-bold text-purple-800">
                            <span>Cuota mensual:</span>
                            <span>${cotizacionActual.cuota_mensual.toLocaleString('es-AR')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            // Generar texto de cotización para WhatsApp
                            let mensaje = `🚗 *COTIZACIÓN ${cotizacionActual.vehiculo.marca.toUpperCase()} ${cotizacionActual.vehiculo.modelo.toUpperCase()}*\n\n`;
                            mensaje += `📋 Configuración: ${cotizacionActual.configuracion.charAt(0).toUpperCase() + cotizacionActual.configuracion.slice(1)}\n`;
                            mensaje += `💰 Precio final: ${cotizacionActual.total_final.toLocaleString('es-AR')}\n`;
                            mensaje += `📅 Plan: ${cotizacionActual.plan_financiacion.nombre}\n`;
                            mensaje += `💳 Cuota mensual: ${cotizacionActual.cuota_mensual.toLocaleString('es-AR')}\n\n`;
                            
                            if (cotizacionActual.descuentos.length > 0) {
                              mensaje += `🎯 *Descuentos aplicados:*\n`;
                              cotizacionActual.descuentos.forEach(d => {
                                mensaje += `• ${d.descripcion}\n`;
                              });
                              mensaje += `\n`;
                            }
                            
                            if (cotizacionActual.vehiculo_usado) {
                              mensaje += `🔄 *Vehículo en parte de pago:*\n`;
                              mensaje += `${cotizacionActual.vehiculo_usado.marca} ${cotizacionActual.vehiculo_usado.modelo} ${cotizacionActual.vehiculo_usado.anio}\n`;
                              mensaje += `Valor estimado: ${cotizacionActual.vehiculo_usado.valor_estimado.toLocaleString('es-AR')}\n\n`;
                            }
                            
                            mensaje += `⏰ *¡Oferta válida por tiempo limitado!*\n`;
                            mensaje += `📞 ¿Te interesa? ¡Coordinemos una cita!`;
                            
                            // Actualizar el lead con la cotización
                            handleUpdateCotizador(leadParaCotizar.id, mensaje);
                          }}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          ✅ Guardar Cotización
                        </button>
                        
                        <button
                          onClick={() => {
                            const phoneNumber = leadParaCotizar.telefono.replace(/\D/g, '');
                            let mensaje = `🚗 *COTIZACIÓN ${cotizacionActual.vehiculo.marca.toUpperCase()} ${cotizacionActual.vehiculo.modelo.toUpperCase()}*\n\n`;
                            mensaje += `Hola ${leadParaCotizar.nombre}, te envío la cotización que solicitaste:\n\n`;
                            mensaje += `📋 Configuración: ${cotizacionActual.configuracion.charAt(0).toUpperCase() + cotizacionActual.configuracion.slice(1)}\n`;
                            mensaje += `💰 Precio final: ${cotizacionActual.total_final.toLocaleString('es-AR')}\n`;
                            mensaje += `📅 Plan: ${cotizacionActual.plan_financiacion.nombre}\n`;
                            mensaje += `💳 Cuota mensual: ${cotizacionActual.cuota_mensual.toLocaleString('es-AR')}\n\n`;
                            mensaje += `⏰ ¡Oferta válida por tiempo limitado!\n`;
                            mensaje += `📞 ¿Te interesa? ¡Coordinemos una cita!`;
                            
                            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(mensaje)}`;
                            window.open(whatsappUrl, '_blank');
                          }}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          📱 Enviar por WhatsApp
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-4xl mb-4">🧮</div>
                      <p>Configura los parámetros y genera una cotización</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Presupuesto (versión simplificada) */}
        {showPresupuestoModal && editingLeadPresupuesto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Presupuesto - {editingLeadPresupuesto.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowPresupuestoModal(false);
                    setEditingLeadPresupuesto(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Presupuesto personalizado para WhatsApp
                </label>
                <textarea
                  id="presupuesto-textarea"
                  defaultValue={editingLeadPresupuesto.presupuesto || ""}
                  placeholder={`Ejemplo:
🚗 ${editingLeadPresupuesto.modelo}
💰 Precio: $XXX.XXX
📝 Incluye: Seguro, patentamiento, transferencia
🔧 Garantía: XX meses
💳 Financiación: Hasta XX cuotas
🎁 Bonificación especial: $XX.XXX`}
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={() => {
                    const textarea = document.getElementById("presupuesto-textarea") as HTMLTextAreaElement;
                    if (textarea && editingLeadPresupuesto) {
                      handleUpdatePresupuesto(editingLeadPresupuesto.id, textarea.value);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Guardar Presupuesto
                </button>
                <button
                  onClick={() => {
                    setShowPresupuestoModal(false);
                    setEditingLeadPresupuesto(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Cotizador Simple */}
        {showCotizadorModal && editingLeadCotizador && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Cotización Manual - {editingLeadCotizador.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowCotizadorModal(false);
                    setEditingLeadCotizador(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> Para una cotización automática completa con cálculos de financiación, usa el botón 🧮 "Cotizador Automático"
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cotización manual para WhatsApp
                </label>
                <textarea
                  id="cotizador-textarea"
                  defaultValue={editingLeadCotizador.cotizador || ""}
                  placeholder={`Ejemplo:
📊 COTIZACIÓN ESPECIAL
🚗 ${editingLeadCotizador.modelo}
💵 Valor: $XXX.XXX
🔥 OFERTA HOY: $XXX.XXX (Ahorro $XX.XXX)
📅 Entrega inmediata
💳 Cuotas desde $X.XXX
⏰ Oferta válida hasta: DD/MM/AAAA`}
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={() => {
                    const textarea = document.getElementById("cotizador-textarea") as HTMLTextAreaElement;
                    if (textarea && editingLeadCotizador) {
                      handleUpdateCotizador(editingLeadCotizador.id, textarea.value);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Guardar Cotización
                </button>
                <button
                  onClick={() => {
                    setShowCotizadorModal(false);
                    setEditingLeadCotizador(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        {showPresupuestoModal && editingLeadPresupuesto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Presupuesto Azofix - {editingLeadPresupuesto.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowPresupuestoModal(false);
                    setEditingLeadPresupuesto(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Cliente:</span> {editingLeadPresupuesto.nombre} | 
                  <span className="font-medium ml-2">Vehículo:</span> {editingLeadPresupuesto.modelo}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Presupuesto personalizado para WhatsApp
                </label>
                <textarea
                  id="presupuesto-textarea"
                  defaultValue={editingLeadPresupuesto.presupuesto || ""}
                  placeholder={`Ejemplo:
🚗 ${editingLeadPresupuesto.modelo}
💰 Precio: $XXX.XXX
📝 Incluye: Seguro, patentamiento, transferencia
🔧 Garantía: XX meses
💳 Financiación: Hasta XX cuotas
🎁 Bonificación especial: $XX.XXX`}
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Este texto se agregará automáticamente al mensaje de WhatsApp
                </p>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={() => {
                    const textarea = document.getElementById("presupuesto-textarea") as HTMLTextAreaElement;
                    if (textarea && editingLeadPresupuesto) {
                      handleUpdatePresupuesto(editingLeadPresupuesto.id, textarea.value);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Guardar Presupuesto
                </button>
                <button
                  onClick={() => {
                    setShowPresupuestoModal(false);
                    setEditingLeadPresupuesto(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NUEVO: Modal de Cotizador Azofix */}
        {showCotizadorModal && editingLeadCotizador && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Cotizador Azofix - {editingLeadCotizador.nombre}
                </h3>
                <button
                  onClick={() => {
                    setShowCotizadorModal(false);
                    setEditingLeadCotizador(null);
                  }}
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Cliente:</span> {editingLeadCotizador.nombre} | 
                  <span className="font-medium ml-2">Vehículo:</span> {editingLeadCotizador.modelo}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cotización especial para WhatsApp
                </label>
                <textarea
                  id="cotizador-textarea"
                  defaultValue={editingLeadCotizador.cotizador || ""}
                  placeholder={`Ejemplo:
📊 COTIZACIÓN ESPECIAL
🚗 ${editingLeadCotizador.modelo}
💵 Valor: $XXX.XXX
🔥 OFERTA HOY: $XXX.XXX (Ahorro $XX.XXX)
📅 Entrega inmediata
💳 Cuotas desde $X.XXX
⏰ Oferta válida hasta: DD/MM/AAAA`}
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Esta cotización se agregará automáticamente al mensaje de WhatsApp
                </p>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={() => {
                    const textarea = document.getElementById("cotizador-textarea") as HTMLTextAreaElement;
                    if (textarea && editingLeadCotizador) {
                      handleUpdateCotizador(editingLeadCotizador.id, textarea.value);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Guardar Cotización
                </button>
                <button
                  onClick={() => {
                    setShowCotizadorModal(false);
                    setEditingLeadCotizador(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Observaciones del Lead */}
        {showObservacionesModal && editingLeadObservaciones && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  Observaciones - {editingLeadObservaciones.nombre}
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
                  <span className="font-medium">Cliente:</span>{" "}
                  {editingLeadObservaciones.nombre} |{" "}
                  <span className="font-medium ml-2">Teléfono:</span>{" "}
                  {editingLeadObservaciones.telefono} |{" "}
                  <span className="font-medium ml-2">Vehículo:</span>{" "}
                  {editingLeadObservaciones.modelo}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Estado actual:</span>
                  <span
                    className={`ml-2 px-2 py-1 rounded-full text-xs font-medium text-white ${estados[editingLeadObservaciones.estado].color}`}
                  >
                    {estados[editingLeadObservaciones.estado].label}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
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
                    const textarea = document.getElementById(
                      "observaciones-textarea"
                    ) as HTMLTextAreaElement;
                    if (textarea && editingLeadObservaciones) {
                      handleUpdateObservaciones(
                        editingLeadObservaciones.id,
                        textarea.value
                      );
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
                  <span className="font-medium">Cliente:</span>{" "}
                  {viewingLeadHistorial.nombre} |{" "}
                  <span className="font-medium ml-2">Teléfono:</span>{" "}
                  {viewingLeadHistorial.telefono} |{" "}
                  <span className="font-medium ml-2">Vehículo:</span>{" "}
                  {viewingLeadHistorial.modelo}
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
                              estados[entry.estado]?.color || "bg-gray-500"
                            }`}
                          >
                            {estados[entry.estado]?.label || entry.estado}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleDateString("es-AR")}{" "}
                            {new Date(entry.timestamp).toLocaleTimeString("es-AR")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">
                          Actualizado por: {entry.usuario}
                        </p>
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

        {/* MODIFICADO: Modal: Nuevo Lead - Con restricciones por rol */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    id="new-nombre"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="text"
                    id="new-telefono"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    id="new-modelo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Forma de Pago
                  </label>
                  <select
                    id="new-formaPago"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Financiado">Financiado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Info Usado
                  </label>
                  <input
                    type="text"
                    id="new-infoUsado"
                    placeholder="Marca Modelo Año"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    id="new-fecha"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2 flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="new-entrega"
                    className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Entrega de vehículo usado
                  </span>
                </div>
                <div className="col-span-2 flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="new-autoassign"
                    defaultChecked
                    className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Asignación automática y equitativa a vendedores activos de mi equipo
                  </span>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asignar a vendedor específico (opcional)
                  </label>
                  <select
                    id="new-vendedor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin asignar</option>
                    {/* MODIFICADO: Solo mostrar vendedores disponibles según el scope */}
                    {getAvailableVendorsForAssignment().map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} - {userById.get(u.reportsTo)?.name ? `Equipo ${userById.get(u.reportsTo)?.name}` : 'Sin equipo'} ✓ Activo
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Si está activada la "Asignación automática", se ignorará esta selección.
                    Solo puedes asignar a vendedores activos de tu equipo.
                  </p>
                </div>

                {/* NUEVO: Información sobre qué vendedores están disponibles */}
                {getAvailableVendorsForAssignment().length === 0 && (
                  <div className="col-span-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-700">
                      <strong>Atención:</strong> No hay vendedores activos disponibles en tu equipo. 
                      El lead se creará sin asignar.
                    </p>
                  </div>
                )}

                <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">
                    Información sobre la creación de leads:
                  </h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Este lead aparecerá marcado como "Creado por {currentUser?.name}"</li>
                    <li>• La fuente se establecerá automáticamente como "Creado por"</li>
                    <li>• Solo puedes asignar a vendedores activos de tu scope/equipo</li>
                    {currentUser?.role === "vendedor" && (
                      <li>• Como vendedor, puedes crear leads pero solo asignártelos a ti mismo</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={handleCreateLead}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Crear Lead
                </button>
                <button
                  onClick={() => setShowNewLeadModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    id="ev-title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    id="ev-date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora
                  </label>
                  <input
                    type="time"
                    id="ev-time"
                    defaultValue="09:00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuario
                  </label>
                  <select
                    id="ev-user"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    defaultValue={currentUser?.id}
                  >
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

              <div className="flex space-x-3 pt-6">
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

        {/* MODIFICADO: Modal: Usuario - Con validación de contraseña mejorada */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    id="u-name"
                    defaultValue={editingUser?.name || ""}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="u-email"
                    defaultValue={editingUser?.email || ""}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña {editingUser ? "(dejar vacío para mantener actual)" : "*"}
                  </label>
                  <input
                    type="password"
                    id="u-pass"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={
                      editingUser ? "Nueva contraseña (opcional)" : "Contraseña obligatoria"
                    }
                  />
                  {!editingUser && (
                    <p className="text-xs text-gray-500 mt-1">
                      La contraseña es obligatoria para usuarios nuevos
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    value={modalRole}
                    onChange={(e) => {
                      const newRole = e.target.value as typeof modalRole;
                      setModalRole(newRole);
                      const validManagers = validManagersByRole(newRole);
                      setModalReportsTo(validManagers[0]?.id ?? null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reporta a *
                    </label>
                    <select
                      value={modalReportsTo || ""}
                      onChange={(e) =>
                        setModalReportsTo(
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {validManagersByRole(modalRole).map((manager: any) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} ({roles[manager.role] || manager.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="u-active"
                    defaultChecked={editingUser?.active !== false}
                    className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="u-active" className="text-sm text-gray-700">
                    Usuario activo
                  </label>
                </div>
                {modalRole === "vendedor" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Nota:</strong> Los vendedores desactivados pueden seguir usando el CRM 
                      para gestionar sus leads existentes, pero no recibirán leads nuevos automáticamente.
                    </p>
                  </div>
                )}

                {/* NUEVO: Información sobre permisos según el rol */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-800 mb-2">
                    Permisos del rol {roles[modalRole] || modalRole}:
                  </h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {modalRole === "owner" && (
                      <>
                        <li>• Acceso completo al sistema</li>
                        <li>• Gestión total de usuarios y equipos</li>
                        <li>• Visualización de todos los datos</li>
                      </>
                    )}
                    {modalRole === "director" && (
                      <>
                        <li>• Gestión de gerentes, supervisores y vendedores</li>
                        <li>• Visualización de todos los equipos</li>
                        <li>• Creación y asignación de leads</li>
                      </>
                    )}
                    {modalRole === "gerente" && (
                      <>
                        <li>• Gestión de supervisores y vendedores de su equipo</li>
                        <li>• Visualización de su equipo completo</li>
                        <li>• Creación y asignación de leads a su equipo</li>
                      </>
                    )}
                    {modalRole === "supervisor" && (
                      <>
                        <li>• Gestión de vendedores directos</li>
                        <li>• Visualización de su equipo directo</li>
                        <li>• Creación y asignación de leads a su equipo</li>
                      </>
                    )}
                    {modalRole === "vendedor" && (
                      <>
                        <li>• Gestión de sus propios leads</li>
                        <li>• Creación de leads (autoasignados)</li>
                        <li>• Visualización de su propio ranking</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>

              <div className="flex space-x-3 pt-6">
                <button
                  onClick={saveUser}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
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
      </div>
    </div>
  );
}