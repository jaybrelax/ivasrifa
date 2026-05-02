import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import logo from '@/img/ivas_logo.png';

export default function NovaSenha() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Verifica se o usuário tem uma sessão válida (o link do email loga o usuário temporariamente)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Se não tem sessão, possivelmente o link é inválido ou expirou
        setError('Sessão inválida ou expirada. Por favor, solicite a recuperação de senha novamente.');
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;
      
      setSuccess(true);
      
      // Redireciona para o login após 3 segundos
      setTimeout(() => {
        // Opcional: Fazer sign out para forçar o usuário a logar com a nova senha
        supabase.auth.signOut().then(() => {
          navigate('/login');
        });
      }, 3000);
      
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50 to-slate-100/50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <img src={logo} alt="IVAS Logo" className="h-20 w-auto object-contain" />
        </div>
        <h2 className="text-center text-3xl font-bold text-slate-900 tracking-tight">
          Recuperação de Acesso
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border-none shadow-2xl shadow-blue-900/5 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6 pt-8">
            <CardTitle className="text-2xl font-bold tracking-tight">Nova Senha</CardTitle>
            <CardDescription className="text-slate-500">Defina uma nova senha para sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <h3 className="text-xl font-bold text-slate-900">Senha Redefinida!</h3>
                <p className="text-slate-500">Sua senha foi alterada com sucesso. Você será redirecionado para o login em instantes.</p>
                <Button 
                  onClick={() => navigate('/login')} 
                  className="mt-4 w-full bg-slate-900 hover:bg-slate-800"
                >
                  Ir para Login agora
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-700 ml-1">Nova Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="h-12 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/10 transition-all text-base"
                    disabled={!!error && error.includes('Sessão inválida')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700 ml-1">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/10 transition-all text-base"
                    disabled={!!error && error.includes('Sessão inválida')}
                  />
                </div>

                <div className="pt-2 flex flex-col space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]" 
                    disabled={loading || (!!error && error.includes('Sessão inválida'))}
                  >
                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <KeyRound className="mr-2 h-5 w-5" />}
                    Salvar Nova Senha
                  </Button>
                  
                  <button 
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
                  >
                    Voltar para o Login
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
