import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Calendar, Users, Trophy, Plus, Phone, BarChart3, Settings, Home, X, Trash2, 
  Edit3, Bell, UserCheck, ArrowRight, TrendingUp, Activity, FileText, 
  MessageSquare, Clock, Target, Award, ChevronDown, Filter, Download, Upload, 
  RefreshCw, CheckCircle, Eye, Search, Star, Zap, TrendingDown, AlertTriangle,
  PieChart, Globe, Mail, Smartphone, MapPin, Car, Menu, LogOut, User, Building,
  Briefcase, BarChart, FileBarChart, Save, UserPlus, Send, Copy, ExternalLink, 
  Heart, Shield, Coffee, ArrowDown, RotateCcw, DollarSign, CalendarDays,
  MessageCircle, Bot, Headphones, CreditCard, LineChart, Users2, Building2,
  Gauge, Database, Lock, Wifi, PlayCircle, PauseCircle, Camera, Mic, FileImage,
  Archive, Bookmark, Flag, ScanLine, QrCode, Printer, FileSpreadsheet, Layers,
  ChevronUp
} from "lucide-react";

// API Configuration
const API_BASE_URL = 'https://alluma-crm-backend-production.up.railway.app/api';

// Types
interface Usuario {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'director' | 'gerente' | 'supervisor' | 'vendedor';
  active: boolean;
  reportsTo?: number;
  created_at?: string;
  updated_at?: string;
  leadDistribution?: number;
  team?: string;
}

interface Lead {
  id: number;
  nombre: string;
  telefono: string;
  modelo: string;
  formaPago?: string;
  estado: keyof typeof estados;
  fuente: keyof typeof fuentes | string;
  notas: string;
  assigned_to: number | null;
  equipo: string;
  created_at: string;
  presupuesto?: number;
  probabilidad?: number;
  tags?: string[];
  score?: number;
}

interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  type: 'call' | 'meeting' | 'follow-up' | 'demo';
  leadId?: number;
  userId: number;
  description: string;
}

interface Alert {
  id: number;
  userId: number;
  type: "lead_assigned" | "ranking_change";
  message: string;
  ts: string;
  read: boolean;
}

// Constants
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
  no_contesta_3: { label: "No contesta 3", color: "bg-red-600" }
} as const;

const fuentes = {
  meta: { label: "Meta/Facebook", color: "bg-blue-600", icon: "📱" },
  whatsapp: { label: "WhatsApp Bot", color: "bg-green-500", icon: "💬" },
  whatsapp_100: { label: "WhatsApp Bot 100", color: "bg-green-700", icon: "💬" },
  sitio_web: { label: "Sitio Web", color: "bg-purple-600", icon: "🌐" },
  referido: { label: "Referido", color: "bg-orange-500", icon: "👥" },
  telefono: { label: "Llamada", color: "bg-indigo-500", icon: "📞" },
  showroom: { label: "Showroom", color: "bg-gray-600", icon: "🏢" },
  google: { label: "Google Ads", color: "bg-red-500", icon: "🎯" },
  instagram: { label: "Instagram", color: "bg-pink-500", icon: "📸" },
  zapier: { label: "Zapier", color: "bg-orange-600", icon: "⚡" },
  otro: { label: "Otro", color: "bg-gray-400", icon: "❓" }
} as const;

const roles = {
  owner: "Dueño",
  director: "Director",
  gerente: "Gerente", 
  supervisor: "Supervisor",
  vendedor: "Vendedor"
} as const;

const vwModelos = [
  "VW Virtus", "VW Polo", "VW T-Cross", "VW Nivus", "VW Amarok",
  "VW Tiguan", "VW Vento", "VW Gol", "VW Up!", "VW Saveiro"
];

export default function AllumaCRM() {
  // Main States
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [users, setUsers] = useState<Usuario[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedManagerView, setSelectedManagerView] = useState<number | null>(null);
  const [loginError, setLoginError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  
  // Filter States
  const [selectedEstado, setSelectedEstado] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  
  // Modal States
  const [showNewLeadModal, setShowNewLeadModal] = useState<boolean>(false);
  const [showLeadDetailModal, setShowLeadDetailModal] = useState<boolean>(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [leadToReassign, setLeadToReassign] = useState<Lead | null>(null);
  const [selectedVendorForReassign, setSelectedVendorForReassign] = useState<number | null>(null);
  const [showDistributionModal, setShowDistributionModal] = useState<boolean>(false);
  const [showNewEventModal, setShowNewEventModal] = useState<boolean>(false);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [showObservacionesModal, setShowObservacionesModal] = useState<boolean>(false);
  const [showHistorialModal, setShowHistorialModal] = useState<boolean>(false);
  const [editingLeadObservaciones, setEditingLeadObservaciones] = useState<Lead | null>(null);
  const [viewingLeadHistorial, setViewingLeadHistorial] = useState<Lead | null>(null);
  const [expandedStates, setExpandedStates] = useState<{[key: string]: boolean}>({});

  // Round-robin and alerts
  const nextAlertId = useRef(1);

  // API Functions
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  };

  // Utility Functions
  const buildIndex = (users: Usuario[]) => {
    const byId = new Map(users.map((u) => [u.id, u]));
    const children = new Map<number, number[]>();
    users.forEach((u) => children.set(u.id, []));
    users.forEach((u) => {
      if (u.reportsTo) (children.get(u.reportsTo) as number[] | undefined)?.push(u.id);
    });
    return { byId, children };
  };

  const { byId: userById, children: childrenIndex } = useMemo(() => buildIndex(users), [users]);

  const getDescendantUserIds = (rootId: number, childrenIndex: Map<number, number[]>) => {
    const out: number[] = [];
    const stack = [...(childrenIndex.get(rootId) || [])];
    while (stack.length) {
      const id = stack.pop()!;
      out.push(id);
      const kids = childrenIndex.get(id) || [];
      for (const k of kids) stack.push(k);
    }
    return out;
  };

  const getMyTeamMembers = (managerId: number): number[] => {
    const manager = users.find(u => u.id === managerId);
    if (!manager) return [];
    
    let team: number[] = [];
    
    // Owner/Director sees EVERYONE
    if (['owner', 'director'].includes(manager.role)) {
      team = users.filter(u => u.id !== managerId).map(u => u.id);
      return team;
    }
    
    // Direct reports
    const directReports = users.filter(u => u.reportsTo === managerId);
    team = directReports.map(u => u.id);
    
    // For hierarchical access (gerente sees their supervisors and their sellers)
    if (manager.role === 'gerente') {
      directReports.forEach(member => {
        team = [...team, ...getMyTeamMembers(member.id)];
      });
    }
    
    return team;
  };

  const getAccessibleUserIds = (user: Usuario | null) => {
    if (!user) return [] as number[];
    if (['owner', 'director'].includes(user.role)) return users.map((u) => u.id);
    const ids = [user.id, ...getDescendantUserIds(user.id, childrenIndex)];
    return ids;
  };

  const getTeamsByGerentes = () => {
    const gerentes = users.filter(u => u.role === 'gerente' && u.active);
    return gerentes.map(gerente => ({
      id: gerente.id,
      name: gerente.name,
      teamName: gerente.name.split(' ')[0].toLowerCase() // Roberto Sauer -> roberto
    }));
  };

  // Data Loading Functions
  const loadUsers = async () => {
    try {
      const data = await apiCall('/users');
      setUsers(data.map((user: any) => ({
        ...user,
        leadDistribution: 0 // Initialize distribution
      })));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadLeads = async () => {
    try {
      const data = await apiCall('/leads');
      if (data.ok && data.leads) {
        setLeads(data.leads.map((lead: any) => ({
          ...lead,
          presupuesto: Math.floor(Math.random() * 10000) + 15000,
          probabilidad: Math.floor(Math.random() * 80) + 20,
          tags: ["nuevo"],
          score: Math.floor(Math.random() * 40) + 60
        })));
      }
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  };

  // Initialize data
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
      loadUsers();
      loadLeads();
    }
  }, []);

  // Permission and Access Control Functions
  const getFilteredLeads = (): Lead[] => {
    let filtered = leads;
    
    // Filter by role permissions
    if (currentUser) {
      const viewingUser = selectedManagerView ? users.find(u => u.id === selectedManagerView) : currentUser;
      if (viewingUser) {
        if (['owner', 'director'].includes(viewingUser.role)) {
          // Owner/Director sees ALL leads
        } else if (viewingUser.role === 'vendedor') {
          // Vendedor only sees their own leads
          filtered = filtered.filter(lead => lead.assigned_to === viewingUser.id);
        } else {
          // Gerente and Supervisor see their team's leads only
          const myTeam = getMyTeamMembers(viewingUser.id);
          filtered = filtered.filter(lead => 
            lead.assigned_to === viewingUser.id || 
            myTeam.includes(lead.assigned_to || 0)
          );
        }
      }
    }
    
    if (selectedEstado && selectedEstado !== "todos") {
      filtered = filtered.filter(lead => lead.estado === selectedEstado);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(lead => 
        lead.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.telefono.includes(searchTerm)
      );
    }
    
    return filtered;
  };

  const getUserById = (id: number | null): Usuario | null => {
    if (!id) return null;
    return users.find(u => u.id === id) || null;
  };

  const canViewCalendar = (userId: number): boolean => {
    if (!currentUser) return false;
    if (currentUser.id === userId) return true;
    
    return (
      ['owner', 'director'].includes(currentUser.role) ||
      getMyTeamMembers(currentUser.id).includes(userId)
    );
  };

  const canManageDistribution = (): boolean => {
    if (!currentUser) return false;
    return ['owner', 'director', 'gerente'].includes(currentUser.role);
  };

  const canManageUsers = () =>
    currentUser && ["owner", "director", "gerente"].includes(currentUser.role);

  const getLeadsByState = () => {
    const filtered = getFilteredLeads();
    return Object.entries(estados).map(([key, estado]) => {
      const stateLeads = filtered.filter(l => l.estado === key);
      return {
        state: key,
        label: estado.label,
        color: estado.color,
        count: stateLeads.length,
        leads: stateLeads
      };
    });
  };

  const sendWhatsAppMessage = (phoneNumber: string, message: string) => {
    const formattedPhone = phoneNumber.replace(/[^\d]/g, '');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // Alert Functions
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

  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token && data.user) {
          localStorage.setItem('authToken', data.token);
          setCurrentUser(data.user);
          setIsAuthenticated(true);
          setLoginError("");
          
          // Load data after successful login
          await Promise.all([loadUsers(), loadLeads()]);
          return true;
        }
      }
      
      setLoginError("Email o contraseña incorrectos");
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setLoginError("Error de conexión");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      await apiCall(`/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ estado: newStatus }),
      });

      setLeads(prev =>
        prev.map(l => (l.id === leadId ? { ...l, estado: newStatus as keyof typeof estados } : l))
      );
    } catch (error) {
      console.error('Error updating lead status:', error);
      alert('Error al actualizar el estado del lead');
    }
  };

  const handleCreateLead = async (): Promise<void> => {
    const nombreInput = document.getElementById("new-nombre") as HTMLInputElement;
    const telefonoInput = document.getElementById("new-telefono") as HTMLInputElement;
    const modeloInput = document.getElementById("new-modelo") as HTMLInputElement;
    const formaPagoSelect = document.getElementById("new-formaPago") as HTMLSelectElement;
    const infoUsadoInput = document.getElementById("new-infoUsado") as HTMLInputElement;
    const entregaInput = document.getElementById("new-entrega") as HTMLInputElement;
    const fechaInput = document.getElementById("new-fecha") as HTMLInputElement;
    const fuenteSelect = document.getElementById("new-fuente") as HTMLSelectElement;
    const vendedorSelect = document.getElementById("new-vendedor") as HTMLSelectElement;
    const equipoSelect = document.getElementById("new-equipo") as HTMLSelectElement;

    if (!nombreInput?.value || !telefonoInput?.value || !modeloInput?.value) {
      alert("Por favor, completa los campos obligatorios");
      return;
    }

    const leadData = {
      nombre: nombreInput.value,
      telefono: telefonoInput.value,
      modelo: modeloInput.value,
      formaPago: formaPagoSelect.value || "Contado",
      infoUsado: infoUsadoInput.value || "",
      entrega: entregaInput?.checked || false,
      fecha: fechaInput.value || new Date().toISOString().split('T')[0],
      fuente: fuenteSelect.value,
      vendedor: vendedorSelect.value ? parseInt(vendedorSelect.value) : null,
      equipo: equipoSelect.value || "roberto"
    };

    try {
      setLoading(true);
      const response = await apiCall('/leads', {
        method: 'POST',
        body: JSON.stringify(leadData),
      });

      if (response.ok && response.lead) {
        const newLead = {
          ...response.lead,
          presupuesto: Math.floor(Math.random() * 10000) + 15000,
          probabilidad: 30,
          tags: ["nuevo"],
          score: Math.floor(Math.random() * 40) + 60
        };
        
        setLeads(prev => [newLead, ...prev]);
        setShowNewLeadModal(false);

        // Clear form
        nombreInput.value = "";
        telefonoInput.value = "";
        modeloInput.value = "";
        infoUsadoInput.value = "";
        if (entregaInput) entregaInput.checked = false;
        if (fechaInput) fechaInput.value = "";
      }
    } catch (error) {
      console.error('Error creating lead:', error);
      alert('Error al crear el lead');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (): Promise<void> => {
    const nameInput = document.getElementById("u-name") as HTMLInputElement;
    const emailInput = document.getElementById("u-email") as HTMLInputElement;
    const passwordInput = document.getElementById("u-pass") as HTMLInputElement;
    const roleSelect = document.getElementById("u-role") as HTMLSelectElement;
    const reportsToSelect = document.getElementById("u-reports-to") as HTMLSelectElement;
    const activeInput = document.getElementById("u-active") as HTMLInputElement;

    if (!nameInput?.value || !emailInput?.value) {
      alert("Por favor, completa los campos obligatorios");
      return;
    }

    const userData = {
      name: nameInput.value,
      email: emailInput.value,
      role: roleSelect.value,
      reportsTo: reportsToSelect.value ? parseInt(reportsToSelect.value) : null,
      active: activeInput.checked ? 1 : 0,
      ...((!editingUser && passwordInput.value) && { password: passwordInput.value })
    };

    try {
      setLoading(true);
      let response;
      
      if (editingUser) {
        response = await apiCall(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(userData),
        });
        
        setUsers(prev => prev.map(user => 
          user.id === editingUser.id ? { ...user, ...response } : user
        ));
      } else {
        response = await apiCall('/users', {
          method: 'POST',
          body: JSON.stringify(userData),
        });
        
        setUsers(prev => [...prev, { ...response, leadDistribution: 0 }]);
      }

      setShowUserModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error al guardar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number): Promise<void> => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    if (['owner', 'director'].includes(target.role)) {
      alert("No se puede eliminar al Dueño/Director.");
      return;
    }
    
    const hasChildren = users.some(u => u.reportsTo === userId);
    if (hasChildren) {
      alert("No se puede eliminar: el usuario tiene integrantes a cargo.");
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar a ${target.name}?`)) {
      return;
    }

    try {
      await apiCall(`/users/${userId}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar el usuario');
    }
  };

  const updateDistribution = (userId: number, percentage: number) => {
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        return { ...user, leadDistribution: percentage };
      }
      return user;
    }));
  };

  const toggleStateExpansion = (state: string) => {
    setExpandedStates(prev => ({
      ...prev,
      [state]: !prev[state]
    }));
  };

  const handleUpdateObservaciones = async (leadId: number, observaciones: string) => {
    try {
      await apiCall(`/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ notas: observaciones }),
      });

      setLeads(prev =>
        prev.map(l => (l.id === leadId ? { ...l, notas: observaciones } : l))
      );
      setShowObservacionesModal(false);
      setEditingLeadObservaciones(null);
    } catch (error) {
      console.error('Error updating lead notes:', error);
      alert('Error al actualizar las observaciones');
    }
  };

  // Reasignación
  const openReassignModal = (lead: Lead) => {
    setLeadToReassign(lead);
    setSelectedVendorForReassign(lead.assigned_to);
    setShowReassignModal(true);
  };

  const handleReassignLead = async () => {
    if (!leadToReassign) return;

    try {
      await apiCall(`/leads/${leadToReassign.id}`, {
        method: 'PUT',
        body: JSON.stringify({ assigned_to: selectedVendorForReassign }),
      });

      setLeads(prev =>
        prev.map(l =>
          l.id === leadToReassign.id
          ? { ...l, assigned_to: selectedVendorForReassign }
          : l
        )
      );

      if (selectedVendorForReassign) {
        pushAlert(
          selectedVendorForReassign,
          "lead_assigned",
          `Lead reasignado: ${leadToReassign.nombre} - ${leadToReassign.modelo}`
        );
      }

      setShowReassignModal(false);
      setLeadToReassign(null);
      setSelectedVendorForReassign(null);
    } catch (error) {
      console.error('Error reassigning lead:', error);
      alert('Error al reasignar el lead');
    }
  };

  const getAvailableVendorsForReassign = () => {
    if (!currentUser) return [];

    let visibleUsers = [];
    if (['owner', 'director'].includes(currentUser.role)) {
      visibleUsers = users;
    } else {
      const myTeam = getMyTeamMembers(currentUser.id);
      visibleUsers = users.filter(u => u.id === currentUser.id || myTeam.includes(u.id));
    }

    return visibleUsers.filter(u => u.role === "vendedor" && u.active);
  };

  // Stats and metrics
  const getDashboardStats = () => {
    const filteredLeads = getFilteredLeads();
    const vendidos = filteredLeads.filter((lead) => lead.estado === "vendido").length;
    const conversion = filteredLeads.length > 0 ? ((vendidos / filteredLeads.length) * 100).toFixed(1) : "0";
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
          ...fuentes[source as keyof typeof fuentes],
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    return sourceData;
  };

  const getRankingInScope = () => {
    const visibleUserIds = getAccessibleUserIds(currentUser);
    const vendedores = users.filter(
      (u) => u.role === "vendedor" && visibleUserIds.includes(u.id)
    );
    return vendedores
      .map((v) => {
        const ventas = leads.filter(
          (l) => l.assigned_to === v.id && l.estado === "vendido"
        ).length;
        const leadsAsignados = leads.filter((l) => l.assigned_to === v.id).length;
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

  const getVisibleUsers = () => {
    if (!currentUser) return [];

    return users.filter((u) => {
      if (['owner', 'director'].includes(currentUser.role)) return true;

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

  const getManagerOptions = () => {
    if (!currentUser) return [];
    
    if (['owner', 'director'].includes(currentUser.role)) {
      return users.filter(u => u.id !== currentUser.id && u.active);
    } else if (currentUser.role === 'gerente') {
      return users.filter(u => u.reportsTo === currentUser.id && u.role === 'supervisor' && u.active);
    } else if (currentUser.role === 'supervisor') {
      return users.filter(u => u.reportsTo === currentUser.id && u.role === 'vendedor' && u.active);
    }
    
    return [];
  };

  // Login Form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 flex items-center justify-center p-4">
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
                id="login-email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="tu@alluma.com"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <input
                type="password"
                id="login-password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{loginError}</p>
              </div>
            )}
            <button
              onClick={() => {
                const emailInput = document.getElementById("login-email") as HTMLInputElement;
                const passwordInput = document.getElementById("login-password") as HTMLInputElement;
                handleLogin(emailInput.value, passwordInput.value);
              }}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return renderDashboard();
      case "leads": 
        return renderLeads();
      case "calendar":
        return renderCalendar();
      case "ranking":
        return renderRanking();
      case "team":
        return renderTeam();
      case "alerts":
        return renderAlerts();
      case "users":
        return renderUsers();
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => {
    const stats = getDashboardStats();
    const sourceMetrics = getSourceMetrics();
    const leadsByState = getLeadsByState();

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalLeads}</p>
                <p className="text-sm text-blue-600 mt-1">
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  Leads activos
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vendidos</p>
                <p className="text-3xl font-bold text-gray-900">{stats.vendidos}</p>
                <p className="text-sm text-green-600 mt-1">
                  <Trophy className="w-4 h-4 inline mr-1" />
                  Este mes
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversión</p>
                <p className="text-3xl font-bold text-gray-900">{stats.conversion}%</p>
                <p className="text-sm text-purple-600 mt-1">
                  <Target className="w-4 h-4 inline mr-1" />
                  Meta: 20%
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leads by State */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Distribución de Leads</h3>
            <div className="space-y-4">
              {leadsByState.map(({ state, label, color, count }) => {
                const percentage = stats.totalLeads > 0 ? ((count / stats.totalLeads) * 100).toFixed(1) : '0';
                return (
                  <div key={state} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${color}`}></div>
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">{count}</span>
                        <span className="text-xs text-gray-500 ml-1">({percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${color}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Source Performance */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Fuentes de Leads</h3>
            <div className="space-y-4">
              {sourceMetrics.slice(0, 5).map(({ source, label, total, conversion, color, icon }) => (
                <div key={source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white text-lg`}>
                      {icon}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{label}</p>
                      <p className="text-sm text-gray-500">{total} leads</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{conversion}%</p>
                    <p className="text-xs text-gray-500">conversión</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Actividad Reciente</h3>
            <button
              onClick={() => setActiveSection("leads")}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
            >
              Ver todos
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="space-y-3">
            {getFilteredLeads().slice(0, 8).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-4">
                  <div className={`w-2 h-2 rounded-full ${estados[lead.estado].color}`}></div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{lead.nombre}</p>
                      <p className="text-xs text-gray-500">{lead.modelo} - {lead.fuente}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${estados[lead.estado].color} text-white`}>
                    {estados[lead.estado].label}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderLeads = () => {
    const leadsByState = getLeadsByState();

    return (
      <div className="space-y-6">
        {/* Enhanced Filters */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filtros Avanzados</h3>
            <button
              onClick={() => {
                setSelectedEstado(null);
                setSearchTerm("");
              }}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Limpiar filtros
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(estados).map(([key, estado]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedEstado(selectedEstado === key ? null : key)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedEstado === key
                        ? `${estado.color} text-white`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {estado.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fuente</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                onChange={(e) => {
                  // Add source filter logic here if needed
                }}
              >
                <option value="">Todas las fuentes</option>
                {Object.entries(fuentes).map(([key, fuente]) => (
                  <option key={key} value={key}>{fuente.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Leads by State with Enhanced UI */}
        <div className="space-y-4">
          {leadsByState.map(({ state, label, color, count, leads: stateLeads }) => (
            <div key={state} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
              <button
                onClick={() => toggleStateExpansion(state)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-4 h-4 rounded-full ${color}`}></div>
                  <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
                  <span className={`${color} text-white px-3 py-1 rounded-full text-sm font-medium`}>
                    {count}
                  </span>
                  {count > 0 && (
                    <span className="text-sm text-gray-500">
                      ${stateLeads.reduce((sum, lead) => sum + (lead.presupuesto || 0), 0).toLocaleString()} total
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {((count / getFilteredLeads().length) * 100 || 0).toFixed(1)}%
                  </span>
                  {expandedStates[state] ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedStates[state] && (
                <div className="border-t border-gray-100">
                  {stateLeads.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay leads en este estado</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {stateLeads.map((lead) => (
                        <div key={lead.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-gray-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-4 mb-2">
                                    <h4 className="font-semibold text-gray-900">{lead.nombre}</h4>
                                    <span className="text-sm text-gray-500">•</span>
                                    <span className="text-sm text-gray-600">{lead.modelo}</span>
                                    <div className="flex items-center space-x-2">
                                      <Phone className="w-4 h-4 text-gray-400" />
                                      <span className="text-sm text-gray-600">{lead.telefono}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${fuentes[lead.fuente as keyof typeof fuentes]?.color || 'bg-gray-100'} text-white`}>
                                      {fuentes[lead.fuente as keyof typeof fuentes]?.icon} {fuentes[lead.fuente as keyof typeof fuentes]?.label || lead.fuente}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Vendedor: <span className="font-medium">{getUserById(lead.assigned_to)?.name || "Sin asignar"}</span>
                                    </span>
                                    <span className="text-sm text-green-600 font-medium">
                                      ${lead.presupuesto?.toLocaleString()}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Equipo: {lead.equipo}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => sendWhatsAppMessage(lead.telefono, `Hola ${lead.nombre}, te escribo desde Alluma Publicidad. ¿Cómo estás? Te contacto por tu consulta sobre ${lead.modelo}.`)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="WhatsApp"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingLeadObservaciones(lead);
                                  setShowObservacionesModal(true);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Observaciones"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <select
                                value={lead.estado}
                                onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500"
                              >
                                {Object.entries(estados).map(([key, estado]) => (
                                  <option key={key} value={key}>{estado.label}</option>
                                ))}
                              </select>
                              {(['owner', 'director', 'gerente', 'supervisor'].includes(currentUser?.role || '')) && (
                                <button
                                  onClick={() => openReassignModal(lead)}
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Reasignar"
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Calendario de Actividades</h3>
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Calendario en desarrollo</p>
            <p className="text-gray-400 text-sm">Próximamente podrás gestionar tus eventos aquí</p>
          </div>
        </div>
      </div>
    );
  };

  const renderRanking = () => {
    const ranking = getRankingInScope();

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Ranking de Vendedores</h3>
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="text-sm text-gray-600">Este mes</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {ranking.map((vendedor, index) => (
              <div key={vendedor.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                    index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500' : 
                    index === 2 ? 'bg-gradient-to-r from-amber-500 to-amber-700' : 'bg-gradient-to-r from-blue-500 to-blue-700'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{vendedor.nombre}</h4>
                      <p className="text-sm text-gray-600">{vendedor.team}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{vendedor.ventas}</p>
                      <p className="text-xs text-gray-500">Ventas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-blue-600">{vendedor.leadsAsignados}</p>
                      <p className="text-xs text-gray-500">Leads</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-purple-600">
                        {vendedor.leadsAsignados > 0 ? ((vendedor.ventas / vendedor.leadsAsignados) * 100).toFixed(1) : '0'}%
                      </p>
                      <p className="text-xs text-gray-500">Conversión</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {ranking.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No hay vendedores disponibles</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTeam = () => {
    const teamMembers = getMyTeamMembers(currentUser?.id || 0);
    const teamUsers = users.filter(u => teamMembers.includes(u.id));

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Mi Equipo</h3>
            <div className="flex space-x-3">
              {canManageDistribution() && (
                <button
                  onClick={() => setShowDistributionModal(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 transition-colors flex items-center"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Distribución
                </button>
              )}
              <button
                onClick={() => setActiveSection('ranking')}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700 transition-colors flex items-center"
              >
                <Trophy className="w-4 h-4 mr-1" />
                Ver Ranking
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamUsers.map((member) => {
              const memberLeads = leads.filter(l => l.assigned_to === member.id);
              const memberSales = memberLeads.filter(l => l.estado === 'vendido');
              const memberRevenue = memberSales.reduce((sum, lead) => sum + (lead.presupuesto || 0), 0);
              
              return (
                <div key={member.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      member.role === 'gerente' ? 'bg-blue-100' :
                      member.role === 'supervisor' ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      <User className={`w-6 h-6 ${
                        member.role === 'gerente' ? 'text-blue-600' :
                        member.role === 'supervisor' ? 'text-green-600' : 'text-purple-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{member.name}</h4>
                      <p className="text-sm text-gray-600">{roles[member.role]}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Leads asignados</span>
                      <span className="font-semibold text-blue-600">{memberLeads.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Ventas cerradas</span>
                      <span className="font-semibold text-green-600">{memberSales.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Tasa conversión</span>
                      <span className="font-semibold text-purple-600">
                        {memberLeads.length > 0 ? ((memberSales.length / memberLeads.length) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Ingresos</span>
                      <span className="font-semibold text-orange-600">${memberRevenue.toLocaleString()}</span>
                    </div>
                    {member.role === 'vendedor' && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Distribución</span>
                        <span className="font-semibold text-indigo-600">{member.leadDistribution || 0}%</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => sendWhatsAppMessage('+5491123456789', `Hola ${member.name}! ¿Cómo va todo?`)}
                      className="flex-1 bg-green-50 text-green-600 px-3 py-2 rounded-lg text-sm hover:bg-green-100 transition-colors flex items-center justify-center"
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      WhatsApp
                    </button>
                    {canViewCalendar(member.id) && (
                      <button
                        onClick={() => {
                          setSelectedUser(member.id);
                          setActiveSection('calendar');
                        }}
                        className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-sm hover:bg-blue-100 transition-colors flex items-center justify-center"
                      >
                        <Calendar className="w-4 h-4 mr-1" />
                        Agenda
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {teamUsers.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No tienes miembros de equipo</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAlerts = () => {
    const userAlerts = alerts.filter(a => a.userId === currentUser?.id);

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Alertas y Notificaciones
            </h3>
            {userAlerts.length > 0 && (
              <button
                onClick={() => {
                  setAlerts(prev => prev.map(a => 
                    a.userId === currentUser?.id ? { ...a, read: true } : a
                  ));
                }}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Marcar todas como leídas
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {userAlerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-600 mb-2">Todo al día</h4>
                <p className="text-gray-500">No tienes alertas nuevas en este momento</p>
              </div>
            ) : (
              userAlerts
                .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
                .map((alert) => (
                <div key={alert.id} className={`p-4 rounded-lg border transition-all ${
                  alert.read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200 shadow-sm'
                }`}>
                  <div className="flex items-start space-x-3">
                    <div className={`w-3 h-3 rounded-full mt-2 ${
                      alert.read ? 'bg-gray-400' : 'bg-blue-500'
                    }`}></div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`text-sm ${alert.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                            {alert.message}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-xs text-gray-500">
                              {new Date(alert.ts).toLocaleString()}
                            </p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              alert.type === 'lead_assigned' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {alert.type === 'lead_assigned' ? 'Lead Asignado' : 'Cambio de Ranking'}
                            </span>
                          </div>
                        </div>
                        {!alert.read && (
                          <button
                            onClick={() => {
                              setAlerts(prev => prev.map(a => 
                                a.id === alert.id ? { ...a, read: true } : a
                              ));
                            }}
                            className="text-blue-600 hover:text-blue-800 ml-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    const visibleUsers = getVisibleUsers();

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Gestión de Usuarios
            </h3>
            <button
              onClick={() => {
                setEditingUser(null);
                setShowUserModal(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:from-blue-700 hover:to-purple-700 transition-all flex items-center"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Nuevo Usuario
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visibleUsers.map((user) => (
              <div key={user.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      user.role === 'owner' ? 'bg-purple-100' :
                      user.role === 'director' ? 'bg-indigo-100' :
                      user.role === 'gerente' ? 'bg-blue-100' :
                      user.role === 'supervisor' ? 'bg-green-100' :
                      'bg-gray-100'
                    }`}>
                      <User className={`w-5 h-5 ${
                        user.role === 'owner' ? 'text-purple-600' :
                        user.role === 'director' ? 'text-indigo-600' :
                        user.role === 'gerente' ? 'text-blue-600' :
                        user.role === 'supervisor' ? 'text-green-600' :
                        'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{user.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'director' ? 'bg-indigo-100 text-indigo-800' :
                        user.role === 'gerente' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'supervisor' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {roles[user.role]}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm font-medium text-gray-900">{user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Reporta a:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {user.reportsTo ? getUserById(user.reportsTo)?.name || '—' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Creado:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setShowUserModal(true);
                    }}
                    className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-sm hover:bg-blue-100 transition-colors flex items-center justify-center"
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Editar
                  </button>
                  {!['owner', 'director'].includes(user.role) && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm hover:bg-red-100 transition-colors flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Main App
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
            <p className="font-medium">{currentUser?.name || currentUser?.email}</p>
            <p className="text-blue-300">
              {roles[currentUser?.role || 'vendedor']}
            </p>
          </div>
        </div>
        <nav className="space-y-2">
          {[
            { key: "dashboard", label: "Dashboard", Icon: Home },
            { key: "leads", label: "Leads", Icon: Users },
            { key: "calendar", label: "Calendario", Icon: Calendar },
            { key: "ranking", label: "Ranking", Icon: Trophy },
            ...(["supervisor", "gerente", "director", "owner"].includes(currentUser?.role || '')
              ? [{ key: "team", label: "Mi Equipo", Icon: UserCheck }]
              : []),
            { key: "alerts", label: "Alertas", Icon: Bell },
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

      {/* Main */}
      <div className="flex-1 p-6">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm rounded-xl mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeSection}</h1>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>
              
              {/* Manager View Selector */}
              {(activeSection === "dashboard" || activeSection === "team") && currentUser && (['owner', 'director'].includes(currentUser.role) || getManagerOptions().length > 0) && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Ver como:</span>
                  <select
                    value={selectedManagerView || currentUser?.id || 0}
                    onChange={(e) => setSelectedManagerView(e.target.value === currentUser?.id.toString() ? null : parseInt(e.target.value))}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={currentUser?.id}>Mi vista</option>
                    {['owner', 'director'].includes(currentUser.role) && 
                      users.filter(u => u.id !== currentUser.id && u.active).map(user => (
                        <option key={user.id} value={user.id}>{user.name} ({roles[user.role]})</option>
                      ))
                    }
                    {!['owner', 'director'].includes(currentUser.role) && 
                      getManagerOptions().map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))
                    }
                  </select>
                </div>
              )}

              {/* Team Filter for Owner/Director */}
              {(activeSection === "dashboard" || activeSection === "team") && ['owner', 'director'].includes(currentUser?.role || '') && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="todos">Todos los equipos</option>
                  {getTeamsByGerentes().map((team) => (
                    <option key={team.id} value={team.teamName}>
                      Equipo {team.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button 
                  onClick={() => setActiveSection("alerts")}
                  className={`p-2 rounded-lg transition-all ${
                    alerts.filter(a => a.userId === currentUser?.id && !a.read).length > 0 
                      ? 'text-red-600 bg-red-50' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title="Alertas"
                >
                  <Bell size={18} />
                  {alerts.filter(a => a.userId === currentUser?.id && !a.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {alerts.filter(a => a.userId === currentUser?.id && !a.read).length}
                    </span>
                  )}
                </button>
              </div>

              <button 
                onClick={() => setShowNewLeadModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all flex items-center"
                disabled={loading}
              >
                <Plus className="w-4 h-4 mr-1" />
                {loading ? 'Cargando...' : 'Nuevo Lead'}
              </button>

              <button 
                onClick={() => {
                  localStorage.removeItem('authToken');
                  setIsAuthenticated(false);
                  setCurrentUser(null);
                }}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                title="Cerrar Sesión"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-40">
            <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Cargando...</span>
            </div>
          </div>
        )}

        {/* Content */}
        <main>
          {renderContent()}
        </main>

        {/* MODALS */}
        {/* New Lead Modal */}
        {showNewLeadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Nuevo Lead</h3>
                <button onClick={() => setShowNewLeadModal(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    id="new-nombre"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                  <input
                    id="new-telefono"
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modelo VW *</label>
                  <select
                    id="new-modelo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar modelo...</option>
                    {vwModelos.map(modelo => (
                      <option key={modelo} value={modelo}>{modelo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pago</label>
                  <select
                    id="new-formaPago"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Financiado">Financiado</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Info del Usado</label>
                  <input
                    id="new-infoUsado"
                    type="text"
                    placeholder="Ej: Toyota Corolla 2018"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    id="new-entrega"
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="new-entrega" className="ml-2 text-sm text-gray-700">
                    Tiene vehículo para entregar
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    id="new-fecha"
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuente</label>
                  <select
                    id="new-fuente"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(fuentes).map(([key, fuente]) => (
                      <option key={key} value={key}>{fuente.icon} {fuente.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipo</label>
                  <select
                    id="new-equipo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {getTeamsByGerentes().map(team => (
                      <option key={team.teamName} value={team.teamName}>
                        Equipo {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor (opcional)</label>
                  <select
                    id="new-vendedor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Asignación automática</option>
                    {getAvailableVendorsForReassign().map(vendor => (
                      <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowNewLeadModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateLead}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Creando...' : 'Crear Lead'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <button onClick={() => setShowUserModal(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    id="u-name"
                    type="text"
                    defaultValue={editingUser?.name || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    id="u-email"
                    type="email"
                    defaultValue={editingUser?.email || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                    <input
                      id="u-pass"
                      type="password"
                      defaultValue="123456"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    id="u-role"
                    defaultValue={editingUser?.role || 'vendedor'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="gerente">Gerente</option>
                    {['owner', 'director'].includes(currentUser?.role || '') && (
                      <>
                        <option value="director">Director</option>
                        <option value="owner">Dueño</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reporta a</label>
                  <select
                    id="u-reports-to"
                    defaultValue={editingUser?.reportsTo || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin supervisor</option>
                    {getVisibleUsers().filter(u => u.id !== editingUser?.id).map(user => (
                      <option key={user.id} value={user.id}>{user.name} ({roles[user.role]})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    id="u-active"
                    type="checkbox"
                    defaultChecked={editingUser?.active ?? true}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="u-active" className="ml-2 text-sm text-gray-700">
                    Usuario activo
                  </label>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveUser}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : editingUser ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Observaciones Modal */}
        {showObservacionesModal && editingLeadObservaciones && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Observaciones</h3>
                <button onClick={() => setShowObservacionesModal(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>{editingLeadObservaciones.nombre}</strong> - {editingLeadObservaciones.modelo}
                </p>
                <textarea
                  id="observaciones-text"
                  defaultValue={editingLeadObservaciones.notas}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Agregar observaciones..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowObservacionesModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const textArea = document.getElementById('observaciones-text') as HTMLTextAreaElement;
                    handleUpdateObservaciones(editingLeadObservaciones.id, textArea.value);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reassign Modal */}
        {showReassignModal && leadToReassign && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Reasignar Lead</h3>
                <button onClick={() => setShowReassignModal(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  <strong>{leadToReassign.nombre}</strong> - {leadToReassign.modelo}
                </p>
                <p className="text-sm text-gray-500 mb-2">
                  Actualmente asignado a: {getUserById(leadToReassign.assigned_to)?.name || 'Sin asignar'}
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo vendedor:</label>
                <select
                  value={selectedVendorForReassign || ''}
                  onChange={(e) => setSelectedVendorForReassign(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin asignar</option>
                  {getAvailableVendorsForReassign().map(vendor => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReassignLead}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Reasignando...' : 'Reasignar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Distribution Modal */}
        {showDistributionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Distribución de Leads</h3>
                <button onClick={() => setShowDistributionModal(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-800">Información</span>
                </div>
                <p className="text-sm text-blue-700">
                  Configura el porcentaje de leads que recibirá cada vendedor. La suma no necesita ser 100%.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                {users.filter(u => u.role === 'vendedor' && (
                  ['owner', 'director'].includes(currentUser?.role || '') ? 
                  true : 
                  getMyTeamMembers(currentUser?.id || 0).includes(u.id)
                )).map(vendor => {
                  return (
                    <div key={vendor.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{vendor.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-blue-600">{vendor.leadDistribution || 0}%</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={vendor.leadDistribution || 0}
                          onChange={(e) => updateDistribution(vendor.id, parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>0%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={vendor.leadDistribution || 0}
                          onChange={(e) => updateDistribution(vendor.id, Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        />
                        <span className="text-gray-500">
                          Leads asignados: {leads.filter(l => l.assigned_to === vendor.id).length}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-medium text-gray-700">Total de distribución:</span>
                  <span className={`font-bold text-lg ${
                    users.filter(u => u.role === 'vendedor' && (['owner', 'director'].includes(currentUser?.role || '') ? true : getMyTeamMembers(currentUser?.id || 0).includes(u.id)))
                      .reduce((sum, u) => sum + (u.leadDistribution || 0), 0) === 100 ? 'text-green-600' : 
                    users.filter(u => u.role === 'vendedor' && (['owner', 'director'].includes(currentUser?.role || '') ? true : getMyTeamMembers(currentUser?.id || 0).includes(u.id)))
                      .reduce((sum, u) => sum + (u.leadDistribution || 0), 0) > 100 ? 'text-red-600' : 'text-orange-600'
                  }`}>
                    {users.filter(u => u.role === 'vendedor' && (['owner', 'director'].includes(currentUser?.role || '') ? true : getMyTeamMembers(currentUser?.id || 0).includes(u.id)))
                      .reduce((sum, u) => sum + (u.leadDistribution || 0), 0)}%
                  </span>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      // Distribuir equitativamente
                      const vendedores = users.filter(u => u.role === 'vendedor' && (['owner', 'director'].includes(currentUser?.role || '') ? true : getMyTeamMembers(currentUser?.id || 0).includes(u.id)));
                      const equalPercentage = Math.floor(100 / vendedores.length);
                      vendedores.forEach(vendor => {
                        updateDistribution(vendor.id, equalPercentage);
                      });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                    Distribuir Equitativamente
                  </button>
                  <button
                    onClick={() => setShowDistributionModal(false)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}