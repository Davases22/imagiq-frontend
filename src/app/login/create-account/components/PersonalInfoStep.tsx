import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiPost } from "@/lib/api-client";
import { identifyEmailEarly } from "@/lib/posthogClient";

interface PersonalInfoData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  codigo_pais: string;
  tipo_documento: string;
  numero_documento: string;
  fecha_nacimiento: string;
  contrasena: string;
  confirmPassword: string;
}

interface PersonalInfoStepProps {
  formData: PersonalInfoData;
  onChange: (data: Partial<PersonalInfoData>) => void;
  disabled?: boolean;
  onValidationChange?: (hasErrors: boolean) => void;
  /** La cuenta de este registro ya existe (se vuelve atras desde el paso 2). */
  cuentaYaCreada?: boolean;
}

export function PersonalInfoStep({ formData, onChange, disabled, onValidationChange, cuentaYaCreada }: PersonalInfoStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Estados para validación de duplicados
  const [emailError, setEmailError] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");
  const [documentError, setDocumentError] = useState<string>("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // La validacion en vivo se apaga cuando la cuenta ya existe: ahi el correo
  // SIEMPRE va a dar "ya registrado" y pintaria un error que no lo es.
  const ENABLE_REALTIME_VALIDATION = !cuentaYaCreada;

  // Notificar al padre cuando cambien los errores de validación
  useEffect(() => {
    // Solo notificar errores si la validación en tiempo real está habilitada
    const hasErrors = ENABLE_REALTIME_VALIDATION && !!(emailError || phoneError || isCheckingEmail);
    if (onValidationChange) {
      onValidationChange(hasErrors);
    }
  }, [emailError, phoneError, isCheckingEmail, onValidationChange]);

  // Función para verificar si el email ya está registrado
  const checkEmailAvailability = useCallback(async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("");
      return;
    }

    setIsCheckingEmail(true);
    setEmailError("");

    try {
      const response = await apiPost<{ exists: boolean; message?: string }>("/api/auth/check-email", {
        email: email.toLowerCase(),
      });

      if (response.exists) {
        setEmailError("Este correo electrónico ya está registrado");
      } else {
        setEmailError("");
      }
    } catch (error) {
      console.log("⚠️ Endpoint de validación de email no disponible (esperado en desarrollo):", error);
      // Si el endpoint no existe (404), no bloquear - permitir continuar
      setEmailError("");
    } finally {
      setIsCheckingEmail(false);
    }
  }, []);

  // Aqui habia checkPhoneAvailability y checkDocumentAvailability. Las dos
  // consultaban al backend en cada pausa de tecleo y tiraban la respuesta a la
  // basura: el telefono puede repetirse entre cuentas (familias, empresas) y el
  // documento tampoco es unico, asi que ya no bloquean nada. Lo unico que
  // conseguian era apagar el boton "Continuar" mientras viajaba la peticion.

  // useEffect con debounce para validar email
  useEffect(() => {
    if (!ENABLE_REALTIME_VALIDATION) return;
    
    const timeoutId = setTimeout(() => {
      if (formData.email) {
        checkEmailAvailability(formData.email);
      }
    }, 350); // 350ms: con 800 la respuesta tardaba ~1,2s en aparecer (800 de espera + ~380 de red) y parecia colgado. 350 sigue sin disparar una peticion por tecla.

    return () => clearTimeout(timeoutId);
  }, [formData.email, checkEmailAvailability]);

  // Validar requisitos de seguridad de la contraseña
  const passwordRequirements = {
    minLength: formData.contrasena.length >= 8,
    hasUpperCase: /[A-Z]/.test(formData.contrasena),
    hasLowerCase: /[a-z]/.test(formData.contrasena),
    hasNumber: /[0-9]/.test(formData.contrasena),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.contrasena),
  };

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);




  // Country codes
  const countryCodes = [
    { code: '+57', country: 'CO', flag: '🇨🇴', label: 'Colombia (+57)' },
    { code: '+1', country: 'US', flag: '🇺🇸', label: 'Estados Unidos (+1)' },
    { code: '+52', country: 'MX', flag: '🇲🇽', label: 'México (+52)' },
    { code: '+54', country: 'AR', flag: '🇦🇷', label: 'Argentina (+54)' },
    { code: '+56', country: 'CL', flag: '🇨🇱', label: 'Chile (+56)' },
    { code: '+51', country: 'PE', flag: '🇵🇪', label: 'Perú (+51)' },
    { code: '+58', country: 'VE', flag: '🇻🇪', label: 'Venezuela (+58)' },
    { code: '+593', country: 'EC', flag: '🇪🇨', label: 'Ecuador (+593)' },
    { code: '+55', country: 'BR', flag: '🇧🇷', label: 'Brasil (+55)' },
    { code: '+34', country: 'ES', flag: '🇪🇸', label: 'España (+34)' },
  ];



  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre *</Label>
          <Input
            id="nombre"
            type="text"
            placeholder="Tu nombre"
            value={formData.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            disabled={disabled}
            autoComplete="given-name"
            autoCapitalize="words"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apellido">Apellido *</Label>
          <Input
            id="apellido"
            type="text"
            placeholder="Tu apellido"
            value={formData.apellido}
            onChange={(e) => onChange({ apellido: e.target.value })}
            disabled={disabled}
            autoComplete="family-name"
            autoCapitalize="words"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico *</Label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            inputMode="email"
            placeholder="tu@email.com"
            value={formData.email}
            onChange={(e) => onChange({ email: e.target.value })}
            onBlur={(e) => identifyEmailEarly(e.target.value)}
            disabled={disabled}
            autoComplete="email"
            autoCapitalize="none"
            className={emailError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
          />
          {ENABLE_REALTIME_VALIDATION && isCheckingEmail && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-black"></div>
            </div>
          )}
        </div>
        {ENABLE_REALTIME_VALIDATION && emailError && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <span className="font-bold">✗</span>
            {emailError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono *</Label>
          <div className="flex gap-2">
            <select
              value={`+${formData.codigo_pais}`}
              onChange={(e) => {
                const newCodigoPais = e.target.value.replace('+', '');
                onChange({ codigo_pais: newCodigoPais });
                // Limpiar errores al cambiar código de país
                setPhoneError("");
              }}
              disabled={disabled}
              style={{ backgroundColor: '#ffffff' }}
              className="w-[110px] h-9 rounded-md border border-input px-3 py-1 text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus:outline-none"
            >
              {countryCodes.map((cc) => (
                <option key={cc.code} value={cc.code}>
                  {cc.flag} {cc.code}
                </option>
              ))}
            </select>
            <div className="flex-1 relative">
              <Input
                id="telefono"
                type="tel"
                inputMode="tel"
                placeholder="3001234567"
                value={formData.telefono}
                onChange={(e) => onChange({ telefono: e.target.value })}
                disabled={disabled}
                autoComplete="tel"
                className={phoneError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
              />
            </div>
          </div>
          {ENABLE_REALTIME_VALIDATION && phoneError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <span className="font-bold">✗</span>
              {phoneError}
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <Label>
            Fecha de nacimiento{" "}
            <span className="font-normal text-gray-500">(opcional)</span>
          </Label>
          {/* Un solo campo de fecha en vez de tres desplegables: en movil abre
              el calendario nativo -un gesto en vez de tres listas largas- y en
              escritorio se escribe de corrido. El valor ya viaja como
              YYYY-MM-DD, que es el formato que el backend espera. */}
          <input
            type="date"
            value={formData.fecha_nacimiento || ""}
            onChange={(e) => onChange({ fecha_nacimiento: e.target.value })}
            disabled={disabled}
            max={new Date().toISOString().split("T")[0]}
            min={`${new Date().getFullYear() - 100}-01-01`}
            style={{ backgroundColor: "#ffffff" }}
            className="block h-9 w-full min-w-0 max-w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tipo_documento">Tipo de documento *</Label>
          <select
            id="tipo_documento"
            value={formData.tipo_documento}
            onChange={(e) => onChange({ tipo_documento: e.target.value })}
            disabled={disabled}
            style={{ backgroundColor: '#ffffff' }}
            className="w-full h-9 rounded-md border border-input px-3 py-1 text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus:outline-none"
          >
            <option value="CC">CC</option>
            <option value="CE">CE</option>
            <option value="PP">Pasaporte</option>
            <option value="NIT">NIT</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="numero_documento">Número *</Label>
          <div className="relative">
            <Input
              id="numero_documento"
              type="text"
              inputMode="numeric"
              placeholder="1234567890"
              value={formData.numero_documento}
              onChange={(e) => onChange({ numero_documento: e.target.value })}
              disabled={disabled}
              autoComplete="off"
              className={documentError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
            />
            {ENABLE_REALTIME_VALIDATION && !documentError && formData.numero_documento && formData.numero_documento.length >= 6 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                <svg className="h-5 w-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            )}
          </div>
          {ENABLE_REALTIME_VALIDATION && documentError && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              {documentError}
            </p>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-2">
          <Label htmlFor="contrasena">Contraseña *</Label>
          <div className="relative">
            <Input
              id="contrasena"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={formData.contrasena}
              onChange={(e) => onChange({ contrasena: e.target.value })}
              disabled={disabled}
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              disabled={disabled}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Indicadores de requisitos de contraseña */}
          {formData.contrasena && (
            <div className="space-y-1 text-xs mt-2">
              <div className={`flex items-center gap-1 transition-colors ${passwordRequirements.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                <span className="font-bold">{passwordRequirements.minLength ? '✓' : '○'}</span>
                <span>Mínimo 8 caracteres</span>
              </div>
              <div className={`flex items-center gap-1 transition-colors ${passwordRequirements.hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                <span className="font-bold">{passwordRequirements.hasUpperCase ? '✓' : '○'}</span>
                <span>Una letra mayúscula</span>
              </div>
              <div className={`flex items-center gap-1 transition-colors ${passwordRequirements.hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}>
                <span className="font-bold">{passwordRequirements.hasLowerCase ? '✓' : '○'}</span>
                <span>Una letra minúscula</span>
              </div>
              <div className={`flex items-center gap-1 transition-colors ${passwordRequirements.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                <span className="font-bold">{passwordRequirements.hasNumber ? '✓' : '○'}</span>
                <span>Un número</span>
              </div>
              <div className={`flex items-center gap-1 transition-colors ${passwordRequirements.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
                <span className="font-bold">{passwordRequirements.hasSpecialChar ? '✓' : '○'}</span>
                <span>Un carácter especial (!@#$%...)</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => onChange({ confirmPassword: e.target.value })}
              disabled={disabled}
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              disabled={disabled}
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Indicador de coincidencia de contraseñas */}
          {formData.confirmPassword && (
            <div className="text-xs mt-2">
              {formData.contrasena === formData.confirmPassword ? (
                <div className="flex items-center gap-1 text-green-600 transition-colors">
                  <span className="font-bold">✓</span>
                  <span>Las contraseñas coinciden</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-600 transition-colors">
                  <span className="font-bold">✗</span>
                  <span>Las contraseñas no coinciden</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
