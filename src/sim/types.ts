export enum BaseTerrain {
  OCEAN = 0,
  PLAIN = 1,
  LOW_HILL = 2,
  MID_MOUNTAIN = 3,
  HIGH_MOUNTAIN = 4,
}

export enum Surface {
  DRY = 0,
  WET = 1,
  RIVER = 2,
  LAKE = 3,
  ICE = 4,
  BARREN = 5,
}

export enum PlantType {
  EMPTY = 0,
  HERB = 1,
  WOODY = 2,
}

export type Season = "spring" | "summer" | "autumn" | "winter";

export interface Spring {
  index: number;
  output?: number;
}

export interface HydrologyStats {
  source: number;
  outflow: number;
  inflow: number;
  oceanSink: number;
  evaporation: number;
  seepage: number;
}

export interface SimState {
  width: number;
  height: number;
  tick: number;
  seed: number;
  scenario: string;
  base: Uint8Array;
  heightMap: Uint8Array;
  surface: Uint8Array;
  water: Float64Array;
  moisture: Float64Array;
  nutrient: Float64Array;
  plantType: Uint8Array;
  plantBiomass: Float64Array;
  plantMaturity: Float64Array;
  plantStress: Float64Array;
  flow: Float64Array;
  hydrologySource: Float64Array;
  hydrologyInflow: Float64Array;
  hydrologyOutflow: Float64Array;
  hydrologyEvaporation: Float64Array;
  hydrologySeepage: Float64Array;
  hydrologyOceanSink: Float64Array;
  flowDirection: Int8Array;
  riverComponent: Int32Array;
  lakeComponent: Int32Array;
  flowMemory: Float64Array;
  standingWaterMemory: Float64Array;
  riverTicks: Uint16Array;
  riverDryTicks: Uint16Array;
  lakeTicks: Uint16Array;
  lakeDryTicks: Uint16Array;
  springs: Spring[];
  lastStats: HydrologyStats;
}

export interface Params {
  waterDepthScale: number;
  noCornerCutting: boolean;
  springOutput: Record<Season, number>;
  waterReserve: number;
  maxOutflowRatio: number;
  flatEpsilon: number;
  flatDiffusionRatio: number;
  evaporationRate: Record<Season, number>;
  seepageRate: number;
  seepToMoistureRatio: number;
  moistureEvaporationRate: number;
  oceanMoistureBaseline: number;
  wetMoistureThreshold: number;
  wetWaterThreshold: number;
  flowMemoryDecay: number;
  standingWaterDecay: number;
  riverThreshold: number;
  riverFormTicks: number;
  riverDecayThreshold: number;
  riverDryTicks: number;
  lakeMemoryThreshold: number;
  lakeOutflowRatioThreshold: number;
  lakeFormTicks: number;
  lakeMinWater: number;
  lakeDryTicks: number;
  lakeAreaSoftCap: number;
  lakeAreaPenalty: number;
  lakeSpillEpsilon: number;
  lakeSpillRate: number;
  lakeSpillMax: number;
  moistureMax: number;
  nutrientMax: number;
  riparianMoistureGain: number;
  riparianNutrientGain: number;
  herbBiomassMax: number;
  herbGrowMoistureMin: number;
  herbGrowNutrientMin: number;
  herbGrowthRate: number;
  herbMoistureUse: number;
  herbNutrientUse: number;
  herbMaturityRate: number;
  herbSeedBiomassThreshold: number;
  herbSeedCost: number;
  herbSeedBiomass: number;
  herbSeedNutrientUse: number;
  herbSpringRecruitmentRate: number;
  herbDeathNutrientRatio: number;
  woodyBiomassMax: number;
  woodyGrowMoistureMin: number;
  woodyGrowNutrientMin: number;
  woodyGrowthRate: number;
  woodyMoistureUse: number;
  woodyNutrientUse: number;
  woodyMaturityRate: number;
  woodySeedBiomassThreshold: number;
  woodySeedCost: number;
  woodySeedBiomass: number;
  woodySeedNutrientUse: number;
  woodyDeathNutrientRatio: number;
  woodyHerbCompetitionBiomass: number;
  woodyHerbReplacementBiomass: number;
}

export interface Metrics {
  tick: number;
  season: Season;
  totalWater: number;
  totalMoisture: number;
  totalNutrient: number;
  herbCells: number;
  herbBiomass: number;
  woodyCells: number;
  woodyBiomass: number;
  herbToWoodyRatio: number;
  grassCoverage: number;
  woodyCoverage: number;
  lowHillWoodyCoverage: number;
  riparianGrassCoverage: number;
  woodyShelterCells: number;
  winterShelterCells: number;
  plantableLandCells: number;
  lowHillPlantableCells: number;
  riparianLandCells: number;
  farLandCells: number;
  riparianMeanMoisture: number;
  farMeanMoisture: number;
  riparianMeanNutrient: number;
  farMeanNutrient: number;
  riparianHerbBiomass: number;
  farHerbBiomass: number;
  meanMoisture: number;
  meanNutrient: number;
  oceanSink: number;
  source: number;
  evaporation: number;
  seepage: number;
  dryCells: number;
  wetCells: number;
  riverCells: number;
  lakeCells: number;
  oceanCells: number;
  maxWater: number;
  meanWater: number;
  flowThrough: number;
  riverComponentCount: number;
  lakeComponentCount: number;
  largestLakeSize: number;
  largestRiverSize: number;
}

export interface Scenario {
  name: string;
  width: number;
  height: number;
  seed: number;
  create: () => SimState;
}
