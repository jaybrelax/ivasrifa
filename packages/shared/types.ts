export interface Rifa {
  id: string;
  titulo: string;
  descricao?: string;
  slug?: string;
  valor_numero: number;
  timeout_reserva: number;
  off_price?: number;
  qtd_off?: number;
  imagem_url?: string;
  status: string;
  created_at: string;
}

export interface Pedido {
  id: string;
  rifa_id: string;
  cliente_id: string;
  vendedor_id?: string;
  numeros: number[];
  quantidade: number;
  valor_total: number;
  status: 'pendente' | 'pago' | 'cancelado';
  venda_direta?: boolean;
  expira_em: string;
  display_id?: string;
  mp_payment_id?: string;
  mp_qr_code?: string;
  mp_pix_copy_paste?: string;
  created_at: string;
}

export interface Cliente {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  telefone: string;
}

export interface Vendedor {
  id: string;
  nome_completo: string;
  codigo_ref: string;
  telefone?: string;
}
