import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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
}

export function PersonalInfoStep({ formData, onChange, disabled, onValidationChange }: PersonalInfoStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Estados para validación de duplicados
  const [emailError, setEmailError] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");
  const [documentError, setDocumentError] = useState<string>("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isCheckingDocument, setIsCheckingDocument] = useState(false);

  // Notificar al padre cuando cambien los errores de validación
  useEffect(() => {
    // Solo notificar errores si la validación en tiempo real está habilitada
    const hasErrors = ENABLE_REALTIME_VALIDATION && !!(emailError || phoneError || documentError || isCheckingEmail || isCheckingPhone || isCheckingDocument);
    if (onValidationChange) {
      onValidationChange(hasErrors);
    }
  }, [emailError, phoneError, documentError, isCheckingEmail, isCheckingPhone, isCheckingDocument, onValidationChange]);

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

  // Función para verificar si el teléfono ya está registrado
  const checkPhoneAvailability = useCallback(async (telefono: string, codigoPais: string) => {
    if (!telefono || telefono.length < 10) {
      setPhoneError("");
      return;
    }

    setIsCheckingPhone(true);
    setPhoneError("");

    try {
      const response = await apiPost<{ exists: boolean; message?: string }>("/api/auth/check-phone", {
        telefono: telefono,
        codigo_pais: codigoPais,
      });

      if (response.exists) {
        setPhoneError("Este número de teléfono ya está registrado");
      } else {
        setPhoneError("");
      }
    } catch (error) {
      console.log("⚠️ Endpoint de validación de teléfono no disponible (esperado en desarrollo):", error);
      // Si el endpoint no existe (404), no bloquear - permitir continuar
      setPhoneError("");
    } finally {
      setIsCheckingPhone(false);
    }
  }, []);

  // Función para verificar si el documento ya está registrado
  const checkDocumentAvailability = useCallback(async (tipoDocumento: string, numeroDocumento: string) => {
    if (!numeroDocumento || numeroDocumento.length < 6) {
      setDocumentError("");
      return;
    }

    setIsCheckingDocument(true);
    setDocumentError("");

    try {
      const response = await apiPost<{ exists: boolean; message?: string }>("/api/auth/check-document", {
        tipo_documento: tipoDocumento,
        numero_documento: numeroDocumento,
      });

      if (response.exists) {
        setDocumentError("Este número de documento ya está registrado");
      } else {
        setDocumentError("");
      }
    } catch (error) {
      console.log("⚠️ Endpoint de validación de documento no disponible (esperado en desarrollo):", error);
      // Si el endpoint no existe (404), no bloquear - permitir continuar
      setDocumentError("");
    } finally {
      setIsCheckingDocument(false);
    }
  }, []);

  // ========================================
  // 🔧 CONFIGURACIÓN DE VALIDACIÓN EN TIEMPO REAL
  // ========================================
  // Los endpoints ya están funcionando (se usan en el paso 2)
  // - POST /api/auth/check-email
  // - POST /api/auth/check-phone
  // - POST /api/auth/check-document
  const ENABLE_REALTIME_VALIDATION = true;

  // useEffect con debounce para validar email
  useEffect(() => {
    if (!ENABLE_REALTIME_VALIDATION) return;
    
    const timeoutId = setTimeout(() => {
      if (formData.email) {
        checkEmailAvailability(formData.email);
      }
    }, 800); // Esperar 800ms después de que el usuario deje de escribir

    return () => clearTimeout(timeoutId);
  }, [formData.email, checkEmailAvailability]);

  // useEffect con debounce para validar teléfono
  useEffect(() => {
    if (!ENABLE_REALTIME_VALIDATION) return;
    
    const timeoutId = setTimeout(() => {
      if (formData.telefono) {
        checkPhoneAvailability(formData.telefono, formData.codigo_pais);
      }
    }, 800); // Esperar 800ms después de que el usuario deje de escribir

    return () => clearTimeout(timeoutId);
  }, [formData.telefono, formData.codigo_pais, checkPhoneAvailability]);

  // useEffect con debounce para validar documento
  useEffect(() => {
    if (!ENABLE_REALTIME_VALIDATION) return;
    
    const timeoutId = setTimeout(() => {
      if (formData.numero_documento) {
        checkDocumentAvailability(formData.tipo_documento, formData.numero_documento);
      }
    }, 800); // Esperar 800ms después de que el usuario deje de escribir

    return () => clearTimeout(timeoutId);
  }, [formData.numero_documento, formData.tipo_documento, checkDocumentAvailability]);

  // Validar requisitos de seguridad de la contraseña
  const passwordRequirements = {
    minLength: formData.contrasena.length >= 8,
    hasUpperCase: /[A-Z]/.test(formData.contrasena),
    hasLowerCase: /[a-z]/.test(formData.contrasena),
    hasNumber: /[0-9]/.test(formData.contrasena),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.contrasena),
  };

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);

  // Estado local para mantener los valores de los dropdowns de fecha
  // Esto permite que el usuario vea su selección incluso si la fecha está incompleta
  const [localDateParts, setLocalDateParts] = useState<{ day: string; month: string; year: string }>(() => {
    // Inicializar desde formData si existe
    if (formData.fecha_nacimiento) {
      const parts = formData.fecha_nacimiento.split('-');
      return { year: parts[0] || '', month: parts[1] || '', day: parts[2] || '' };
    }
    return { day: '', month: '', year: '' };
  });

  // Sincronizar con formData cuando cambie externamente (ej: restaurar desde localStorage)
  useEffect(() => {
    if (formData.fecha_nacimiento) {
      const parts = formData.fecha_nacimiento.split('-');
      setLocalDateParts({ year: parts[0] || '', month: parts[1] || '', day: parts[2] || '' });
    }
  }, [formData.fecha_nacimiento]);

  // Usar valores locales para los dropdowns
  const { day, month, year } = localDateParts;

  // Country codes
  const countryCodes = [
    { code: '+57', country: 'CO', label: 'Colombia (+57)' },
    { code: '+1', country: 'US', label: 'Estados Unidos (+1)' },
    { code: '+52', country: 'MX', label: 'México (+52)' },
    { code: '+54', country: 'AR', label: 'Argentina (+54)' },
    { code: '+56', country: 'CL', label: 'Chile (+56)' },
    { code: '+51', country: 'PE', label: 'Perú (+51)' },
    { code: '+58', country: 'VE', label: 'Venezuela (+58)' },
    { code: '+593', country: 'EC', label: 'Ecuador (+593)' },
    { code: '+55', country: 'BR', label: 'Brasil (+55)' },
    { code: '+34', country: 'ES', label: 'España (+34)' },
  ];

  // Generate date options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  const handleDateChange = (newDay: string, newMonth: string, newYear: string) => {
    // Siempre actualizar el estado local para que los dropdowns muestren la selección del usuario
    setLocalDateParts({ day: newDay, month: newMonth, year: newYear });

    // Solo generar fecha ISO válida cuando los 3 campos estén completos
    // Si falta algún campo, guardar string vacío para evitar errores de validación ISO 8601
    if (newYear && newMonth && newDay) {
      onChange({ fecha_nacimiento: `${newYear}-${newMonth}-${newDay}` });
    } else {
      // Guardar vacío si la fecha está incompleta - evita enviar formatos inválidos como "-01-15"
      onChange({ fecha_nacimiento: "" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre *</Label>
          <Input
            id="nombre"
            type="text"
            placeholder="Juan"
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
            placeholder="Pérez"
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
        {ENABLE_REALTIME_VALIDATION && !emailError && formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && !isCheckingEmail && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <span className="font-bold">✓</span>
            Correo disponible
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className="w-[110px] h-9 rounded-md border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
            >
              {countryCodes.map((cc) => (
                <option key={cc.code} value={cc.code}>
                  {cc.country} {cc.code}
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
              {ENABLE_REALTIME_VALIDATION && isCheckingPhone && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-black"></div>
                </div>
              )}
            </div>
          </div>
          {ENABLE_REALTIME_VALIDATION && phoneError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <span className="font-bold">✗</span>
              {phoneError}
            </p>
          )}
          {ENABLE_REALTIME_VALIDATION && !phoneError && formData.telefono && formData.telefono.length >= 10 && !isCheckingPhone && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span className="font-bold">✓</span>
              Teléfono disponible
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Fecha de nacimiento *</Label>
          <div className="flex gap-2">
            <select
              value={day}
              onChange={(e) => handleDateChange(e.target.value, month, year)}
              disabled={disabled}
              style={{ backgroundColor: '#ffffff' }}
              className={`h-9 w-[70px] rounded-md border px-3 py-1 text-sm focus:outline-none focus:ring-1 ${
                (month || year) && !day
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-black focus:ring-black'
              }`}
            >
              <option value="">Día</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {parseInt(d)}
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => handleDateChange(day, e.target.value, year)}
              disabled={disabled}
              style={{ backgroundColor: '#ffffff' }}
              className={`h-9 flex-1 rounded-md border px-3 py-1 text-sm focus:outline-none focus:ring-1 ${
                (day || year) && !month
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-black focus:ring-black'
              }`}
            >
              <option value="">Mes</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => handleDateChange(day, month, e.target.value)}
              disabled={disabled}
              style={{ backgroundColor: '#ffffff' }}
              className={`h-9 w-[90px] rounded-md border px-3 py-1 text-sm focus:outline-none focus:ring-1 ${
                (day || month) && !year
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-black focus:ring-black'
              }`}
            >
              <option value="">Año</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {/* Mensaje de error cuando faltan campos de fecha */}
          {(day || month || year) && (!day || !month || !year) && (
            <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
              <span className="font-bold">✗</span>
              {!day && !month && !year
                ? "Selecciona día, mes y año"
                : !day && !month
                  ? "Falta seleccionar el día y el mes"
                  : !day && !year
                    ? "Falta seleccionar el día y el año"
                    : !month && !year
                      ? "Falta seleccionar el mes y el año"
                      : !day
                        ? "Falta seleccionar el día"
                        : !month
                          ? "Falta seleccionar el mes"
                          : "Falta seleccionar el año"}
            </p>
          )}
          {/* Mensaje de éxito cuando la fecha está completa */}
          {day && month && year && (
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <span className="font-bold">✓</span>
              Fecha completa
            </p>
          )}
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
            className="w-full h-9 rounded-md border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
          >
            <option value="CC">CC</option>
            <option value="CE">CE</option>
            <option value="TI">TI</option>
            <option value="PA">Pasaporte</option>
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
            {ENABLE_REALTIME_VALIDATION && isCheckingDocument && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              </div>
            )}
            {ENABLE_REALTIME_VALIDATION && !isCheckingDocument && !documentError && formData.numero_documento && formData.numero_documento.length >= 6 && (
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
          {ENABLE_REALTIME_VALIDATION && !documentError && !isCheckingDocument && formData.numero_documento && formData.numero_documento.length >= 6 && (
            <p className="text-sm text-green-500 flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M5 13l4 4L19 7"></path>
              </svg>
              Documento disponible
            </p>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
