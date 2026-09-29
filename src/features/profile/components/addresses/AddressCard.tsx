import React from "react";
import { Home, Building2, MapPin, Check } from "lucide-react";
import { DBAddress } from "../../types";

interface AddressCardProps {
  address: DBAddress;
  onEdit: (id: string) => void;
  /** Se conserva para cuando se reactive el boton de eliminar. */
  onDelete?: (id: string) => void;
  onSetDefault: (id: string) => void;
  loading?: boolean;
}

const AddressCard: React.FC<AddressCardProps> = ({
  address,
  onEdit,
  onSetDefault,
  loading = false,
}) => {
  // Determinar el icono según el tipo
  const getIcon = () => {
    const tipo = address.tipo?.toUpperCase();
    if (tipo === "CASA" || tipo === "AMBOS")
      return <Home className="w-5 h-5" />;
    if (tipo === "TRABAJO") return <Building2 className="w-5 h-5" />;
    return <MapPin className="w-5 h-5" />;
  };

  // Determinar el nombre del tipo
  const getTypeName = () => {
    const tipo = address.tipo?.toUpperCase();
    if (tipo === "CASA") return "Casa";
    if (tipo === "TRABAJO") return "Oficina";
    if (tipo === "AMBOS") return "Casa";
    return "Otra";
  };

  // Determinar si es predeterminada
  const isDefault = address.esPredeterminada || false;
  // Las direcciones de facturación no pueden ser predeterminadas
  const isBilling = address.tipo?.toUpperCase() === "FACTURACION";

  if (loading) {
    return (
      <div className="w-full sm:max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-between p-4 min-h-[180px] animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-2">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
        <div className="h-9 bg-gray-200 rounded-lg mt-4" />
      </div>
    );
  }

  return (
    <div className="w-full sm:max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-between p-4 transition-all hover:shadow-xl min-h-[180px]">
      {/* Header: Icono + Nombre + Acciones */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base text-gray-900 truncate">
            {address.nombreDireccion || getTypeName()}
          </h3>
          {isDefault && !isBilling && (
            <div className="flex items-center gap-1 text-xs text-green-600 font-semibold">
              <Check className="w-3 h-3" />
              Predeterminada
            </div>
          )}
        </div>
        {/* El boton de eliminar se retiro porque la baja de direcciones no
            esta operativa: el usuario lo pulsaba, confirmaba y la direccion
            seguia ahi. Se reactiva junto con el arreglo del borrado. */}
      </div>

      {/* Info dirección */}
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-gray-600 text-sm font-medium mb-1">
          {address.linea_uno}
        </p>
        {address.complemento && (
          <p className="text-gray-600 text-sm mb-1">{address.complemento}</p>
        )}
        <div className="text-gray-600 text-sm mb-1">
          {address.ciudad && address.departamento ? (
            <p>
              {address.ciudad}, {address.departamento}
            </p>
          ) : address.ciudad ? (
            <p>{address.ciudad}</p>
          ) : null}
          {address.pais && (
            <p>{address.pais === "CO" ? "Colombia" : address.pais}</p>
          )}
        </div>
        {address.instruccionesEntrega && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
              Instrucciones
            </p>
            <p className="text-xs text-gray-600">
              {address.instruccionesEntrega}
            </p>
          </div>
        )}
      </div>

      {!isDefault && !isBilling && (
        <button
          onClick={() => onSetDefault(address.id)}
          className="w-full py-2 border border-gray-200 rounded-lg hover:border-black hover:bg-gray-50 transition-all font-semibold text-sm mt-4"
        >
          Establecer como Predeterminada
        </button>
      )}
    </div>
  );
};

export default AddressCard;
