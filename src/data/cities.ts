export type City = {
  name: string
  lat: number
  lon: number
}

const CITIES: City[] = [
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'Houston', lat: 29.76, lon: -95.37 },
  { name: 'Seattle', lat: 47.61, lon: -122.33 },
  { name: 'Denver', lat: 39.74, lon: -104.99 },
  { name: 'Boston', lat: 42.36, lon: -71.06 },
  { name: 'Miami', lat: 25.76, lon: -80.19 },
  { name: 'Atlanta', lat: 33.75, lon: -84.39 },
  { name: 'Honolulu', lat: 21.31, lon: -157.86 },
  { name: 'Anchorage', lat: 61.22, lon: -149.9 },
  { name: 'Toronto', lat: 43.65, lon: -79.38 },
  { name: 'Vancouver', lat: 49.28, lon: -123.12 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'Sao Paulo', lat: -23.55, lon: -46.63 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'Berlin', lat: 52.52, lon: 13.41 },
  { name: 'Madrid', lat: 40.42, lon: -3.7 },
  { name: 'Rome', lat: 41.9, lon: 12.5 },
  { name: 'Amsterdam', lat: 52.37, lon: 4.9 },
  { name: 'Reykjavik', lat: 64.15, lon: -21.94 },
  { name: 'Cairo', lat: 30.04, lon: 31.24 },
  { name: 'Johannesburg', lat: -26.2, lon: 28.05 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Seoul', lat: 37.57, lon: 126.98 },
  { name: 'Beijing', lat: 39.9, lon: 116.41 },
  { name: 'Shanghai', lat: 31.23, lon: 121.47 },
  { name: 'Hong Kong', lat: 22.32, lon: 114.17 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Melbourne', lat: -37.81, lon: 144.96 },
]

const ALIASES: Record<string, string> = {
  nyc: 'New York',
  la: 'Los Angeles',
  sf: 'San Francisco',
  'são paulo': 'Sao Paulo',
  bangalore: 'Bengaluru',
}

export function findCity(query: string): City | undefined {
  const key = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key) return undefined
  const name = (ALIASES[key] ?? query).trim().toLowerCase()
  return CITIES.find((city) => city.name.toLowerCase() === name)
}
