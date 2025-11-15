/**
 * Haversine formula to calculate distance between two points on Earth
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find the nearest branch to a given location
 */
export function findNearestBranch(
  userLat: number,
  userLon: number,
  branches: Array<{
    id: string;
    latitude: number;
    longitude: number;
    name_ar: string;
    name_en: string;
  }>
): {
  branch: any;
  distance: number;
} | null {
  if (!branches || branches.length === 0) {
    return null;
  }

  let nearest = {
    branch: branches[0],
    distance: calculateDistance(
      userLat,
      userLon,
      branches[0].latitude,
      branches[0].longitude
    ),
  };

  for (let i = 1; i < branches.length; i++) {
    const distance = calculateDistance(
      userLat,
      userLon,
      branches[i].latitude,
      branches[i].longitude
    );

    if (distance < nearest.distance) {
      nearest = {
        branch: branches[i],
        distance,
      };
    }
  }

  return nearest;
}
