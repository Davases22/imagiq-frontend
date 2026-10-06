"use client";

import { useAuthContext } from "@/features/auth/context";
import { posthogUtils, identifyEmailEarly } from "@/lib/posthogClient";
import { Cart, Usuario } from "@/types/user";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { notifyError, notifyLoginSuccess } from "./notifications";
import { apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";

interface LoginSuccessResponse {
  access_token?: string;
  user?: Omit<Usuario, "contrasena" | "tipo_documento">;
  telefono_verificado?: boolean; // Indica si el teléfono está verificado
  email_verificado?: boolean; // Indica si el email está verificado
  requiresVerification?: boolean; // Indica si necesita verificación
  userId?: string; // ID del usuario cuando requiere verificación
  email?: string; // Email cuando requiere verificación
  telefono?: string; // Teléfono cuando requiere verificación
  nombre?: string; // Nombre cuando requiere verificación
  apellido?: string; // Apellido cuando requiere verificación
  numero_documento?: string; // Documento cuando requiere verificación
  skus?: string[] | { sku: string }[];
  defaultAddress?: {
    id: string;
    nombreDireccion: string;
    direccionFormateada: string;
    ciudad?: string;
    departamento?: string;
    esPredeterminada: boolean;
  } | null;
}

interface LoginErrorResponse {
  status: number;
  message: string;
}

/**
 * Traduce lo que devuelve el backend a algo que el cliente pueda accionar.
 *
 * Hasta ahora se mostraba `err.message` tal cual, asi que quien fallaba al
 * entrar veia "Internal server error" en ingles, sin ninguna pista de que
 * hacer. Pasaba de verdad: las cuentas creadas al comprar como invitado no
 * tienen contrasena -1.307 de 1.314-, y al intentar entrar el backend reventaba
 * con un 500.
 *
 * El caso de la cuenta sin contrasena ya se arregla en auth-ms, que ahora
 * responde con un mensaje claro. Esto es la red para todo lo demas: cualquier
 * cosa que llegue sin traducir se convierte en una frase util en vez de jerga.
 */
function mensajeDeLogin(crudo: string): string {
  const t = (crudo || "").toLowerCase();

  if (!t || t.includes("fetch") || t.includes("network") || t.includes("conexión"))
    return "No pudimos conectarnos. Revisa tu internet e inténtalo de nuevo.";

  if (t.includes("contraseña incorrecta") || t.includes("unauthorized"))
    return "La contraseña no es correcta. Revísala o restablécela desde \"¿Olvidaste tu contraseña?\".";

  if (t.includes("usuario no encontrado") || t.includes("not found"))
    return "No encontramos una cuenta con ese correo. Revísalo o crea una cuenta.";

  // El backend viejo o cualquier fallo inesperado: nunca mostrar el texto crudo.
  if (t.includes("internal server error") || t.includes("500"))
    return "Algo falló de nuestro lado. Inténtalo de nuevo en un momento y, si sigue igual, restablece tu contraseña.";

  // Si el backend mando un mensaje en espanol y entendible, se respeta.
  return crudo;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthContext();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect === "/login/create-account") {
        setTimeout(() => router.replace("/login/create-account"), 0);
      }
    }
  }, [router]);

  // Verificar si es usuario invitado (rol 3) - los invitados pueden ver el login
  const userRole = (() => {
    if (typeof window === "undefined") return null;
    try {
      const userStr = localStorage.getItem("imagiq_user");
      if (userStr && userStr !== "null" && userStr !== "undefined") {
        const user = JSON.parse(userStr);
        return user?.role ?? user?.rol ?? null;
      }
    } catch {
      return null;
    }
    return null;
  })();

  // Si ya está autenticado y no es invitado, redirigir al home
  useEffect(() => {
    if (isAuthenticated && userRole !== 3) {
      router.replace("/");
    }
  }, [isAuthenticated, userRole, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("Por favor completa todos los campos");
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiPost<LoginSuccessResponse>("/api/auth/login", {
        email: formData.email,
        contrasena: formData.password,
      });

      // 🔒 VERIFICACIÓN OBLIGATORIA - Si el backend retorna requiresVerification
      if (result.requiresVerification) {
        // Guardar datos temporalmente para continuar verificación en paso 2
        sessionStorage.setItem(
          "pending_registration_step2",
          JSON.stringify({
            userId: result.userId,
            email: result.email,
            nombre: result.nombre,
            apellido: result.apellido,
            telefono: result.telefono,
            numero_documento: result.numero_documento,
            fromLogin: true, // Bandera para saber que viene de login
          })
        );

        posthogUtils.capture("login_requires_verification", {
          user_id: result.userId,
          user_email: result.email,
        });

        // Redirigir a create-account (paso 2) para completar verificación
        router.push("/login/create-account");
        return;
      }

      // Validar respuesta normal de login exitoso
      if (!result.access_token || !result.user) {
        throw new Error("Respuesta de servidor inválida");
      }

      const { user, access_token, skus, defaultAddress } = result;

      // ✅ Usuario verificado - Login exitoso
      posthogUtils.capture("login_success", {
        user_id: user.id,
        user_role: user.rol,
      });

      if (skus && Array.isArray(skus)) {
        const skuStrings = skus.map((item) =>
          typeof item === "string" ? item : item.sku
        );
        localStorage.setItem("imagiq_favorites", JSON.stringify(skuStrings));
      }

      localStorage.setItem("imagiq_token", access_token);

      // ✅ CRITICAL: await login to ensure context is fully established
      await login({
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        numero_documento: user.numero_documento,
        telefono: user.telefono,
        role: user.rol,
        defaultAddress: defaultAddress || null,
      });

      await notifyLoginSuccess(user.nombre);

      const cartItems = await apiGet<Cart>("/api/cart");
      if (cartItems) {
        localStorage.setItem("cart-items", JSON.stringify(cartItems.items));
      }

      setTimeout(() => {
        router.push("/");
      }, 500);
    } catch (err) {
      const crudo = err instanceof Error ? err.message : "";
      const msg = mensajeDeLogin(crudo);
      setError(msg);
      await notifyError(msg, "No pudimos iniciar sesión");
      posthogUtils.capture("login_error", {
        email: formData.email,
        error: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // items-center es lo que faltaba: justify-center solo centra en horizontal,
    // asi que la tarjeta quedaba pegada arriba con media pantalla en blanco.
    // Y la altura no puede ser min-h-screen: este div vive dentro del <main>,
    // que ya va debajo del navbar y encima del footer, asi que 100vh aqui
    // sumaba una pantalla entera de alto. 60vh deja el formulario centrado en
    // un bloque generoso y el footer sube a su sitio. Es minimo, no fijo: en
    // movil el formulario es mas alto y el bloque crece con el, sin recortes.
    <div className="min-h-[60vh] bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Iniciar sesión</h1>
          <p className="text-sm text-gray-600">
            Ingresa tus datos para continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              onBlur={(e) => identifyEmailEarly(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                disabled={isLoading}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={isLoading}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-red-600 text-center bg-red-50 py-2 px-4 rounded-lg">
              {error}
            </div>
          )}

          {/* Forgot password & Submit button in same row */}
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/login/password-recovery"
              className="text-sm text-gray-600 hover:text-gray-900 underline whitespace-nowrap"
            >
              ¿Olvidaste tu contraseña?
            </Link>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-black text-white hover:bg-gray-800 rounded-lg px-8"
            >
              {isLoading ? "Verificando..." : "Entrar"}
            </Button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative">
          <Separator />
          {/* Estaba en text-xs/gray-500: 12px de gris claro sobre blanco se
              perdia justo en el punto donde hay que decidir si registrarse. */}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-sm font-medium text-gray-700">
            ¿No tienes cuenta?
          </span>
        </div>

        {/* Create account button */}
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/login/create-account")}
          className="w-full"
        >
          Crear una cuenta
        </Button>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>
            Al continuar, aceptas los{" "}
            <a href="#" className="underline hover:text-gray-900">
              Términos de uso
            </a>{" "}
            y la{" "}
            <a href="#" className="underline hover:text-gray-900">
              Política de privacidad
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
