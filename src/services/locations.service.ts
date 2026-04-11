/**
 * @module LocationsService
 * @description Servicio para obtener departamentos y ciudades de Colombia desde el backend
 * Implementa caché para minimizar peticiones al servidor
 */

const API_BASE_URL = "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

/**
 * Interface para departamento
 */
export interface Department {
  nombre: string;
}

/**
 * Interface para ciudad con código DANE
 */
export interface City {
  codigo: string;
  nombre: string;
}

/**
 * Servicio de ubicaciones con caché en memoria
 */
class LocationsService {
  private departmentsCache: Department[] | null = null;
  private citiesCache: Map<string, City[]> = new Map();
  private allCitiesCache: City[] | null = null;

  /**
   * Obtiene todos los departamentos de Colombia
   * Los resultados se cachean en memoria
   */
  async getDepartments(): Promise<Department[]> {
    // Si ya está en caché, retornar inmediatamente
    if (this.departmentsCache) {
      return this.departmentsCache;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/addresses/departments`, {
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY && { 'X-API-Key': API_KEY }),
        },
      });

      if (!response.ok) {
        throw new Error(`Error al obtener departamentos: ${response.status}`);
      }

      const data = await response.json();

      // Cachear resultado
      this.departmentsCache = data;

      return data;
    } catch (error) {
      console.error('Error obteniendo departamentos:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las ciudades de Colombia
   * Los resultados se cachean en memoria
   */
  async getAllCities(): Promise<City[]> {
    // Si ya está en caché, retornar inmediatamente
    if (this.allCitiesCache) {
      return this.allCitiesCache;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/addresses/cities`, {
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY && { 'X-API-Key': API_KEY }),
        },
      });

      if (!response.ok) {
        throw new Error(`Error al obtener ciudades: ${response.status}`);
      }

      const data = await response.json();

      // Cachear resultado
      this.allCitiesCache = data;

      return data;
    } catch (error) {
      console.error('Error obteniendo todas las ciudades:', error);
      throw error;
    }
  }

  /**
   * Obtiene ciudades filtradas por departamento
   * Los resultados se cachean en memoria por departamento
   *
   * @param departmentName Nombre del departamento (ej: "Antioquia")
   */
  async getCitiesByDepartment(departmentName: string): Promise<City[]> {
    // Si ya está en caché para este departamento, retornar inmediatamente
    if (this.citiesCache.has(departmentName)) {
      return this.citiesCache.get(departmentName)!;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/addresses/cities?department=${encodeURIComponent(departmentName)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY && { 'X-API-Key': API_KEY }),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error al obtener ciudades del departamento ${departmentName}: ${response.status}`);
      }

      const data = await response.json();

      // Cachear resultado para este departamento
      this.citiesCache.set(departmentName, data);

      return data;
    } catch (error) {
      console.error(`Error obteniendo ciudades del departamento ${departmentName}:`, error);
      throw error;
    }
  }

  /**
   * Limpia toda la caché
   * Útil si se necesita forzar la recarga de datos
   */
  clearCache(): void {
    this.departmentsCache = null;
    this.citiesCache.clear();
    this.allCitiesCache = null;
  }

  /**
   * Limpia solo la caché de ciudades
   */
  clearCitiesCache(): void {
    this.citiesCache.clear();
    this.allCitiesCache = null;
  }

  /**
   * Limpia solo la caché de departamentos
   */
  clearDepartmentsCache(): void {
    this.departmentsCache = null;
  }
}

// Exportar instancia singleton
export const locationsService = new LocationsService();
