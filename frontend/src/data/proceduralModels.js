// Procedural 3D models, looked up by a product's model_type (used by the placement preview).
// Kept apart from the component files so those export only components (React Fast Refresh).
import {
  CoconutPalm, Bougainvillea, BambooCluster, Frangipani, BirdOfParadise,
  BananaPlant, TravelersPalm, Hibiscus, Duranta, Santan,
} from '../components/ProceduralPlants';
import { RiverStones, SteppingPath, GardenBench, TrellisArch, SolarLight } from '../components/ProceduralHardscape';

export const PLANT_COMPONENTS = {
  coconut_palm: CoconutPalm,
  bougainvillea: Bougainvillea,
  bamboo: BambooCluster,
  frangipani: Frangipani,
  bird_of_paradise: BirdOfParadise,
  banana: BananaPlant,
  travelers_palm: TravelersPalm,
  hibiscus: Hibiscus,
  duranta: Duranta,
  santan: Santan,
};

export const HARDSCAPE_COMPONENTS = {
  river_stones: RiverStones,
  stepping_path: SteppingPath,
  garden_bench: GardenBench,
  trellis_arch: TrellisArch,
  solar_light: SolarLight,
};
