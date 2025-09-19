import React, { useState, useMemo, useRef } from "react";

// Types
interface IconProps {
  size?: number;
  className?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: "owner" | "director" | "gerente" | "supervisor" | "vendedor";
  reportsTo: number | null;
  active?: boolean;
}

interface HistorialEntry {
  estado: string;
  timestamp: string;
  usuario: string;
}

interface Lead {
  id: number;
  nombre: string;
  telefono: string;
  modelo: string;
  formaPago?: string;
  infoUsado?: string;
  entrega?: boolean;
  estado: string;
  vendedor: number | null;
  fuente: string;
  fecha: string;
  notas?: string;
  historial?: HistorialEntry[];
}

interface Event {
  id: number;
  title: string;
  date: string;
  time?: string;
  userId: number;
}

interface Alert {
  id: number;
  message: string;
  type: "info" | "warning" | "error" | "success";
}

interface UserIndex {
  byId: Map<number, User>;
  children: Map<number, number[]>;
}

interface EstadoInfo {
  label: string;
  color: string;
}

interface FuenteInfo {
  label: string;
  color: string;
  icon: string;
}

interface DashboardStats {
  totalLeads: number;
  vendidos: number;
  conversion: string;
}

interface SourceMetric {
  source: string;
  total: number;
  vendidos: number;
  conversion: number;
  label: string;
  color: string;
  icon: string;
}

interface Vendedor {
  id: number;
  nombre: string;
  ventas: number;
  leadsAsignados: number;
  team: string;
}

// Icon components as simple SVGs
const Calendar: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
    <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/>
    <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/>
    <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/>
  </svg>
);

const Users: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2"/>
    <circle cx="9" cy="7" r="4" strokeWidth="2"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2"/>
  </svg>
);

const Trophy: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" strokeWidth="2"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" strokeWidth="2"/>
    <path d="M4 22h16" strokeWidth="2"/>
    <path d="M10 14.66V17c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-2.34" strokeWidth="2"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" strokeWidth="2"/>
  </svg>
);

const Plus: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2"/>
    <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2"/>
  </svg>
);

const Phone: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeWidth="2"/>
  </svg>
);

const BarChart3: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <line x1="12" y1="20" x2="12" y2="10" strokeWidth="2"/>
    <line x1="18" y1="20" x2="18" y2="4" strokeWidth="2"/>
    <line x1="6" y1="20" x2="6" y2="16" strokeWidth="2"/>
  </svg>
);

const Settings: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" strokeWidth="2"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeWidth="2"/>
  </svg>
);

const Home: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="2"/>
    <polyline points="9,22 9,12 15,12 15,22" strokeWidth="2"/>
  </svg>
);

const X: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" strokeWidth="2"/>
    <line x1="6" y1="6" x2="18" y2="18" strokeWidth="2"/>
  </svg>
);

const Trash2: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="3,6 5,6 21,6" strokeWidth="2"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2"/>
    <line x1="10" y1="11" x2="10" y2="17" strokeWidth="2"/>
    <line x1="14" y1="11" x2="14" y2="17" strokeWidth="2"/>
  </svg>
);

const Edit3: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M12 20h9" strokeWidth="2"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeWidth="2"/>
  </svg>
);

const UserCheck: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2"/>
    <circle cx="8.5" cy="7" r="4" strokeWidth="2"/>
    <polyline points="17,11 19,13 23,9" strokeWidth="2"/>
  </svg>
);

// Mock data and utilities
const roles: Record<string, string> = {
  owner: "Dueño",
  director: "Director",
  gerente: "Gerente",
  supervisor: "Supervisor",
  vendedor: "Vendedor",
};

const estados: Record<string, EstadoInfo> = {
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

const fuentes: Record<string, FuenteInfo> = {
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

// Mock initial data - Empty for production
const initialUsers: User[] = [];
const initialLeads: Lead[] = [];

// Utility functions
function buildIndex(users: User[]): UserIndex {
  const byId = new Map(users.map((u) => [u.id, u]));
  const children = new Map<number, number[]>();
  users.forEach((u) => children.set(u.id, []));
  users.forEach((u) => {
    if (u.reportsTo) children.get(u.reportsTo)?.push(u.id);
  });
  return { byId, children };
}

function getDescendantUserIds(rootId: number, childrenIndex: Map<number, number[]>): number[] {
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

const CRM: React.FC = () => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [loginError, setLoginError] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("todos");
  
  // Modal states
  const [showNewLeadModal, setShowNewLeadModal] = useState<boolean>(false);
  const [showObservacionesModal, setShowObservacionesModal] = useState<boolean>(false);
  const [showHistorialModal, setShowHistorialModal] = useState<boolean>(false);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [showNewEventModal, setShowNewEventModal] = useState<boolean>(false);
  const [editingLeadObservaciones, setEditingLeadObservaciones] = useState<Lead | null>(null);
  const [viewingLeadHistorial, setViewingLeadHistorial] = useState<Lead | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [modalRole, setModalRole] = useState<string>("vendedor");
  const [modalReportsTo, setModalReportsTo] = useState<number | null>(null);
  
  // Calendar and events
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedCalendarUserId, setSelectedCalendarUserId] = useState<number | null>(null);

  const { byId: userById, children: childrenIndex } = useMemo(
    () => buildIndex(users),
    [users]
  );

  // Authentication
  const handleLogin = (email: string, password: string): void => {
    // Mock login for development - replace with real API
    const user = users.find(u => u.email === email);
    if (user && password) { // Simple check - replace with real authentication
      setCurrentUser(user);
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Credenciales incorrectas");
    }
  };

  // Access control
  const getAccessibleUserIds = (user: User | null): number[] => {
    if (!user) return [];
    if (["owner", "director"].includes(user.role))
      return users.map((u) => u.id);
    const ids = [user.id, ...getDescendantUserIds(user.id, childrenIndex)];
    return ids;
  };

  const canManageUsers = (): boolean =>
    currentUser ? ["owner", "director", "gerente"].includes(currentUser.role) : false;

  const isOwner = (): boolean => currentUser?.role === "owner";

  // Visible users based on role
  const getVisibleUsers = (): User[] => {
    if (!currentUser) return [];
    return users.filter((u) => {
      if (currentUser.role === "owner") return true;
      if (currentUser.role === "director") return u.role !== "owner";
      if (currentUser.role === "gerente") {
        if (u.id === currentUser.id) return true;
        if (u.reportsTo === currentUser.id) return true;
        const userSupervisor = userById.get(u.reportsTo);
        return userSupervisor && userSupervisor.reportsTo === currentUser.id;
      }
      if (currentUser.role === "supervisor") {
        if (u.id === currentUser.id) return true;
        return u.reportsTo === currentUser.id;
      }
      return false;
    });
  };

  // Team management
  const getAvailableManagers = (): User[] => {
    return users.filter((u) => u.role === "gerente" && u.active !== false);
  };

  const getTeamUserIds = (teamId: string): number[] => {
    if (teamId === "todos") return [];
    const manager = users.find(
      (u) => u.role === "gerente" && u.id.toString() === teamId
    );
    if (!manager) return [];
    const descendants = getDescendantUserIds(manager.id, childrenIndex);
    return [manager.id, ...descendants];
  };

  // Filtered leads
  const visibleUserIds = useMemo(
    () => getAccessibleUserIds(currentUser),
    [currentUser, users]
  );

  const getFilteredLeads = (): Lead[] => {
    if (!currentUser) return [];
    return leads.filter((l) =>
      l.vendedor ? visibleUserIds.includes(l.vendedor) : true
    );
  };

  const getFilteredLeadsByTeam = (teamId: string): Lead[] => {
    if (!currentUser) return [];
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
    return getFilteredLeads();
  };

  // Dashboard statistics
  const getDashboardStats = (teamFilter?: string): DashboardStats => {
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

  const getSourceMetrics = (teamFilter?: string): SourceMetric[] => {
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

  // ===== Funciones de descarga Excel =====
  const formatDate = (dateString: string): string => {
    if (!dateString) return "Sin fecha";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR");
  };

  const downloadAllLeadsExcel = (): void => {
    if (!currentUser) return;
    
    const teamFilter = ["owner", "director"].includes(currentUser?.role)
      ? selectedTeam
      : undefined;
    
    const filteredLeads = teamFilter && teamFilter !== "todos"
      ? getFilteredLeadsByTeam(teamFilter)
      : getFilteredLeads();

    // Crear datos para Excel
    const excelData = filteredLeads.map(lead => {
      const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
      const fuente = fuentes[lead.fuente] || { label: lead.fuente };
      
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
        'Equipo': vendedor ? `Equipo de ${userById.get(vendedor.reportsTo ?? 0)?.name || '—'}` : '',
        'Fecha': formatDate(lead.fecha),
        'Observaciones': lead.notas || ''
      };
    });

    // Simular descarga (en un entorno real usarías una librería como xlsx)
    console.log('Descargando Excel completo con', excelData.length, 'leads');
    alert(`Descarga simulada: ${excelData.length} leads exportados a Excel`);
  };

  const downloadLeadsByStateExcel = (estado: string): void => {
    if (!currentUser) return;
    
    const teamFilter = ["owner", "director"].includes(currentUser?.role)
      ? selectedTeam
      : undefined;
    
    const filteredLeads = teamFilter && teamFilter !== "todos"
      ? getFilteredLeadsByTeam(teamFilter)
      : getFilteredLeads();
    
    const leadsByState = filteredLeads.filter(l => l.estado === estado);

    if (leadsByState.length === 0) {
      alert(`No hay leads en estado "${estados[estado]?.label || estado}"`);
      return;
    }

    // Crear datos para Excel
    const excelData = leadsByState.map(lead => {
      const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;
      const fuente = fuentes[lead.fuente] || { label: lead.fuente };
      
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
        'Equipo': vendedor ? `Equipo de ${userById.get(vendedor.reportsTo ?? 0)?.name || '—'}` : '',
        'Fecha': formatDate(lead.fecha),
        'Observaciones': lead.notas || '',
        'Historial': lead.historial?.map(h => 
          `${formatDate(h.timestamp)}: ${h.estado} (${h.usuario})`
        ).join(' | ') || ''
      };
    });

    // Simular descarga
    const estadoLabel = estados[estado]?.label || estado;
    console.log(`Descargando Excel de estado "${estadoLabel}" con`, excelData.length, 'leads');
    alert(`Descarga simulada: ${excelData.length} leads en estado "${estadoLabel}" exportados a Excel`);
  };

  // Ranking
  const getRanking = (): Vendedor[] => {
    const vendedores = users.filter((u) => u.role === "vendedor");
    return vendedores
      .map((v) => {
        const ventas = leads.filter(
          (l) => l.vendedor === v.id && l.estado === "vendido"
        ).length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return {
          id: v.id,
          nombre: v.name,
          ventas,
          leadsAsignados,
          team: `Equipo de ${userById.get(v.reportsTo ?? 0)?.name || "—"}`,
        };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  const getRankingInScope = (): Vendedor[] => {
    const vendedores = users.filter(
      (u) => u.role === "vendedor" && visibleUserIds.includes(u.id)
    );
    return vendedores
      .map((v) => {
        const ventas = leads.filter(
          (l) => l.vendedor === v.id && l.estado === "vendido"
        ).length;
        const leadsAsignados = leads.filter((l) => l.vendedor === v.id).length;
        return {
          id: v.id,
          nombre: v.name,
          ventas,
          leadsAsignados,
          team: `Equipo de ${userById.get(v.reportsTo ?? 0)?.name || "—"}`,
        };
      })
      .sort((a, b) => b.ventas - a.ventas);
  };

  // Lead operations
  const handleUpdateLeadStatus = (leadId: number, newStatus: string): void => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              estado: newStatus,
              historial: [
                ...(l.historial || []),
                {
                  estado: newStatus,
                  timestamp: new Date().toISOString(),
                  usuario: currentUser?.name || "Sistema",
                },
              ],
            }
          : l
      )
    );
  };

  const handleCreateLead = (): void => {
    const nombre = (document.getElementById("new-nombre") as HTMLInputElement)?.value?.trim();
    const telefono = (document.getElementById("new-telefono") as HTMLInputElement)?.value?.trim();
    const modelo = (document.getElementById("new-modelo") as HTMLInputElement)?.value?.trim();
    const formaPago = (document.getElementById("new-formaPago") as HTMLSelectElement)?.value;
    const fuente = (document.getElementById("new-fuente") as HTMLSelectElement)?.value;
    const vendedorSelVal = (document.getElementById("new-vendedor") as HTMLSelectElement)?.value;
    
    if (nombre && telefono && modelo && fuente) {
      const newLead: Lead = {
        id: Math.max(0, ...leads.map(l => l.id)) + 1,
        nombre,
        telefono,
        modelo,
        formaPago,
        estado: "nuevo",
        vendedor: vendedorSelVal ? parseInt(vendedorSelVal) : null,
        fuente,
        fecha: new Date().toISOString().slice(0, 10),
        notas: "",
        historial: [{
          estado: "nuevo",
          timestamp: new Date().toISOString(),
          usuario: currentUser?.name || "Sistema"
        }]
      };
      setLeads(prev => [newLead, ...prev]);
      setShowNewLeadModal(false);
    }
  };

  const handleUpdateObservaciones = (leadId: number, observaciones: string): void => {
    setLeads(prev =>
      prev.map(l =>
        l.id === leadId ? { ...l, notas: observaciones } : l
      )
    );
    setShowObservacionesModal(false);
    setEditingLeadObservaciones(null);
  };

  // User management
  const validRolesByUser = (user: User | null): string[] => {
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

  const validManagersByRole = (role: string): User[] => {
    switch (role) {
      case "owner":
        return [];
      case "director":
        return users.filter((u) => u.role === "owner");
      case "gerente":
        return users.filter((u) => u.role === "director");
      case "supervisor":
        return users.filter((u) => u.role === "gerente");
      case "vendedor":
        return users.filter((u) => u.role === "supervisor");
      default:
        return [];
    }
  };

  const openCreateUser = (): void => {
    setEditingUser(null);
    const availableRoles = validRolesByUser(currentUser);
    const roleDefault = availableRoles?.[0] || "vendedor";
    const validManagers = validManagersByRole(roleDefault);
    setModalRole(roleDefault);
    setModalReportsTo(validManagers[0]?.id || null);
    setShowUserModal(true);
  };

  const saveUser = (): void => {
    const name = (document.getElementById("u-name") as HTMLInputElement)?.value?.trim();
    const email = (document.getElementById("u-email") as HTMLInputElement)?.value?.trim();
    const active = (document.getElementById("u-active") as HTMLInputElement)?.checked !== false;

    if (!name || !email) return;

    if (editingUser) {
      setUsers(prev =>
        prev.map(u =>
          u.id === editingUser.id
            ? {
                ...u,
                name,
                email,
                role: modalRole as User['role'],
                reportsTo: modalRole === "owner" ? null : modalReportsTo,
                active
              }
            : u
        )
      );
    } else {
      const newUser: User = {
        id: Math.max(0, ...users.map(u => u.id)) + 1,
        name,
        email,
        role: modalRole as User['role'],
        reportsTo: modalRole === "owner" ? null : modalReportsTo,
        active
      };
      setUsers(prev => [...prev, newUser]);
    }
    setShowUserModal(false);
  };

  const deleteUser = (id: number): void => {
    if (users.find(u => u.id === id)?.role === "owner") {
      alert("No podés eliminar al Dueño.");
      return;
    }
    const hasChildren = users.some(u => u.reportsTo === id);
    if (hasChildren) {
      alert("No se puede eliminar: el usuario tiene integrantes a cargo.");
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  // Calendar operations
  const createEvent = (): void => {
    const title = (document.getElementById("ev-title") as HTMLInputElement)?.value;
    const date = (document.getElementById("ev-date") as HTMLInputElement)?.value;
    const time = (document.getElementById("ev-time") as HTMLInputElement)?.value;
    const userId = parseInt((document.getElementById("ev-user") as HTMLSelectElement)?.value);
    
    if (title && date && userId) {
      setEvents(prev => [
        ...prev,
        {
          id: Math.max(0, ...prev.map(e => e.id)) + 1,
          title,
          date,
          time: time || "09:00",
          userId,
        },
      ]);
      setShowNewEventModal(false);
    }
  };

  const deleteEvent = (id: number): void =>
    setEvents(prev => prev.filter(e => e.id !== id));

  // Calendar filtered events
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

  // Login UI
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
                placeholder="admin@alluma.com"
                defaultValue="admin@alluma.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <input
                type="password"
                id="password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                defaultValue="123456"
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

  // Main authenticated UI
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
              {roles[currentUser?.role || ""] || currentUser?.role}
            </p>
          </div>
        </div>
        <nav className="space-y-2">
          {[
            { key: "dashboard", label: "Dashboard", Icon: Home },
            { key: "leads", label: "Leads", Icon: Users },
            { key: "calendar", label: "Calendario", Icon: Calendar },
            { key: "ranking", label: "Ranking", Icon: Trophy },
            ...(["supervisor", "gerente", "director", "owner"].includes(currentUser?.role || "")
              ? [{ key: "team", label: "Mi Equipo", Icon: UserCheck }]
              : []),
            ...(canManageUsers()
              ? [{ key: "users", label: "Usuarios", Icon: Settings }]
              : []),
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === key
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

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Dashboard */}
        {activeSection === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
              {["owner", "director"].includes(currentUser?.role || "") && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="todos">Todos los equipos</option>
                  {getAvailableManagers().map((gerente) => (
                    <option key={gerente.id} value={gerente.id.toString()}>
                      Equipo {gerente.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Main Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(() => {
                const teamFilter = ["owner", "director"].includes(currentUser?.role || "")
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

            {/* Estados de Leads */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Estados de Leads</h3>
                {["owner", "director"].includes(currentUser?.role || "") && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Descargar Excel:</span>
                    <button
                      onClick={downloadAllLeadsExcel}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      title="Descargar Excel completo"
                    >
                      Todos
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(estados).map(([key, estado]) => {
                  const teamFilter = ["owner", "director"].includes(currentUser?.role || "")
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
                      <div className={`${estado.color} text-white rounded-lg p-4 mb-2 text-center relative`}>
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs opacity-75">{percentage}%</div>
                        
                        {/* Botón de descarga para owner/director */}
                        {["owner", "director"].includes(currentUser?.role || "") && count > 0 && (
                          <button
                            onClick={() => downloadLeadsByStateExcel(key)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-20 hover:bg-opacity-40 rounded p-1"
                            title={`Descargar Excel: ${estado.label}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M9 17h6a2 2 0 002-2V9a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 text-center font-medium">
                        {estado.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Source Metrics */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Performance por Fuente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const teamFilter = ["owner", "director"].includes(currentUser?.role || "")
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
                    {getFilteredLeads().map((lead) => {
                      const vendedor = lead.vendedor ? userById.get(lead.vendedor) : null;

                      return (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">{lead.nombre}</div>
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
                                {fuentes[lead.fuente]?.icon || "❓"}
                              </span>
                              <span className="text-xs text-gray-600">
                                {fuentes[lead.fuente]?.label || String(lead.fuente)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-700">
                            {vendedor?.name || "Sin asignar"}
                          </td>
                          <td className="px-4 py-4 text-gray-500 text-xs">
                            {lead.fecha ? String(lead.fecha).slice(0, 10) : "—"}
                          </td>
                          <td className="px-4 py-4 text-center">
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
                              <button
                                onClick={() => {
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
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Calendar */}
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
                  {getVisibleUsers()
                    .filter((u) => u.id !== currentUser?.id)
                    .map((u) => (
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
                  {eventsForSelectedUser.map((event) => (
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

        {/* Ranking */}
        {activeSection === "ranking" && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">Ranking de Vendedores</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    No hay vendedores en tu scope
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Team Section */}
        {activeSection === "team" &&
          ["supervisor", "gerente", "director", "owner"].includes(currentUser?.role || "") && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-800">Mi Equipo</h2>
              </div>

              {/* Team statistics by status */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Estados de Leads - Mi Equipo
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(estados).map(([key, estado]) => {
                    const filteredLeads = getFilteredLeads();
                    const count = filteredLeads.filter((l) => l.estado === key).length;
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

              {/* Top performers in organization */}
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

        {/* Users */}
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
                    {getVisibleUsers().map((user) => {
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
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                user.active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {user.active ? "Activo" : "Inactivo"}
                            </span>
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
                                onClick={() => {
                                  setEditingUser(user);
                                  setModalRole(user.role);
                                  setModalReportsTo(user.reportsTo);
                                  setShowUserModal(true);
                                }}
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
      </div>

      {/* Modals */}
      
      {/* New Lead Modal */}
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
                  Nombre
                </label>
                <input
                  type="text"
                  id="new-nombre"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  id="new-telefono"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  id="new-modelo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Pago
                </label>
                <select
                  id="new-formaPago"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Contado">Contado</option>
                  <option value="Financiado">Financiado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fuente del Lead
                </label>
                <select
                  id="new-fuente"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  defaultValue="sitio_web"
                >
                  {Object.entries(fuentes).map(([key, fuente]) => (
                    <option key={key} value={key}>
                      {fuente.icon} {fuente.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asignar a vendedor (opcional)
                </label>
                <select
                  id="new-vendedor"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Sin asignar</option>
                  {getVisibleUsers()
                    .filter((u) => u.role === "vendedor")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.active ? "" : "(inactivo)"}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex space-x-3 pt-6">
              <button
                onClick={handleCreateLead}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

      {/* Observaciones Modal */}
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
                  const textarea = document.getElementById("observaciones-textarea") as HTMLTextAreaElement;
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

      {/* Historial Modal */}
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

      {/* New Event Modal */}
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
                  Título
                </label>
                <input
                  type="text"
                  id="ev-title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  id="ev-date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuario
                </label>
                <select
                  id="ev-user"
                  defaultValue={currentUser?.id}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={currentUser?.id}>{currentUser?.name} (Yo)</option>
                  {getVisibleUsers()
                    .filter((u) => u.id !== currentUser?.id)
                    .map((u) => (
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

      {/* User Modal */}
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
                  Nombre
                </label>
                <input
                  type="text"
                  id="u-name"
                  defaultValue={editingUser?.name || ""}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
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
                  id="u-pass"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder={
                    editingUser ? "Nueva contraseña (opcional)" : "Contraseña"
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol
                </label>
                <select
                  value={modalRole}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    setModalRole(newRole);
                    const validManagers = validManagersByRole(newRole);
                    setModalReportsTo(validManagers[0]?.id || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {validRolesByUser(currentUser).map((role) => (
                    <option key={role} value={role}>
                      {roles[role] || role}
                    </option>
                  ))}
                </select>
              </div>
              {modalRole !== "owner" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reporta a
                  </label>
                  <select
                    value={modalReportsTo || ""}
                    onChange={(e) =>
                      setModalReportsTo(
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {validManagersByRole(modalRole).map((manager) => (
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
                  className="rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="u-active" className="text-sm text-gray-700">
                  Usuario activo
                </label>
              </div>
            </div>

            <div className="flex space-x-3 pt-6">
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
    </div>
  );
};

export default CRM;