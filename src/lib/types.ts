export type UserRole = "admin" | "gestor" | "cliente_admin" | "cliente_leitor";
export type ClientPhase = "proposta" | "onboarding" | "setup" | "ativo" | "offboarding" | "arquivado";
export type RequestKind = "dado" | "acesso" | "asset" | "aprovacao" | "questionario";
export type RequestStatus = "pendente" | "enviado" | "concluido";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  client_id: string | null;
}

export interface Client {
  id: string;
  name: string;
  legal_name: string | null;
  nif: string | null;
  website: string | null;
  phase: ClientPhase;
  looker_url: string | null;
  drive_folder_id: string | null;
  clickup_list_id: string | null;
  offboarded_at: string | null;
  created_at: string;
}

export interface ClientRequest {
  id: string;
  client_id: string;
  kind: RequestKind;
  title: string;
  description: string | null;
  due_date: string | null;
  status: RequestStatus;
  created_at: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  gestor: "Gestor",
  cliente_admin: "Cliente · admin",
  cliente_leitor: "Cliente · leitura",
};

/** Fases mostradas ao cliente, por ordem. Offboarding e arquivado ficam fora da barra. */
export const CLIENT_PHASES: { key: ClientPhase; label: string }[] = [
  { key: "proposta", label: "Proposta" },
  { key: "onboarding", label: "Onboarding" },
  { key: "setup", label: "Setup" },
  { key: "ativo", label: "Campanhas ativas" },
];

export const PHASE_LABEL: Record<ClientPhase, string> = {
  proposta: "Proposta",
  onboarding: "Onboarding",
  setup: "Setup",
  ativo: "Campanhas ativas",
  offboarding: "Offboarding",
  arquivado: "Arquivado",
};

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  dado: "Dados",
  acesso: "Acesso",
  asset: "Ficheiros",
  aprovacao: "Aprovação",
  questionario: "Questionário",
};
