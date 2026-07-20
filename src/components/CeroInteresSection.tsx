import { cn } from '@/lib/utils';
import CeroInteresLogos from './CeroInteresLogos';
import { ZeroInterestSkuResult } from '@/services/cero-interes-sku.service';

interface CeroInteresSectionProps {
  ceroInteresData?: ZeroInterestSkuResult[];
  isInChat?: boolean;
  className?: string;
}

/**
 * Sección reutilizable de "Compra con 0% de interés"
 * 
 * Muestra el mensaje de cero interés con bancos aliados
 * y los logos de Bancolombia/Davivienda cuando aplican.
 * 
 * Usado en ProductCard y BundleCard
 */
export default function CeroInteresSection({
  ceroInteresData,
  isInChat = false,
  className,
}: CeroInteresSectionProps) {
  // Solo renderizar si hay datos de cero interés
  if (!ceroInteresData || ceroInteresData.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col items-center gap-0.5 sm:gap-1 px-1 w-full', className)}>
      <p
        className={cn(
          'text-blue-600 font-bold text-center leading-tight',
          isInChat
            ? 'text-[8px] sm:text-[9px]' // Más pequeño en chat
            : 'text-[8px] sm:text-[9px] md:text-xs lg:text-sm' // Tamaño normal
        )}
      >
        Compra con 0% de interés con bancos aliados{' '}
        <span
          className={cn(
            'text-gray-500 block sm:inline',
            isInChat
              ? 'text-[5px] sm:text-[6px]' // Más pequeño en chat
              : 'text-[6px] sm:text-[7px] md:text-[8px] lg:text-[9px]' // Tamaño normal
          )}
        >
          Aplican T&C
        </span>
      </p>
      
      {/* Logos de bancos */}
      <CeroInteresLogos entidades={ceroInteresData} />
    </div>
  );
}
