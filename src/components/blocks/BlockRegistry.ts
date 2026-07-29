/**
 * Avani AI — Block Registry (68 UI Block Types)
 * The Block Architect AI picks from these to build unique layouts per video.
 */

// ==========================================
// 1. CONTENT BLOCKS
// ==========================================

export interface HeroSummaryBlock {
  type: 'hero_summary';
  data: {
    title: string;
    description: string;
    badge?: string;
    duration?: string;
    difficultyLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  };
}

export interface QuoteHighlightBlock {
  type: 'quote_highlight';
  data: {
    quote: string;
    speakerName: string;
    speakerTitle?: string;
  };
}

export interface FunFactBlock {
  type: 'fun_fact';
  data: {
    fact: string;
    category?: string;
    icon?: string;
  };
}

export interface VideoContextBlock {
  type: 'video_context';
  data: {
    region: string;
    climateZone: string;
    season: string;
    farmingType: string;
    targetCropsOrLivestock: string[];
  };
}

export interface NarratorNoteBlock {
  type: 'narrator_note';
  data: {
    note: string;
    importance: 'low' | 'medium' | 'high' | 'critical';
    authorName?: string;
  };
}

export interface KeyTakeawaysBlock {
  type: 'key_takeaways';
  data: {
    title?: string;
    takeaways: Array<{
      point: string;
      elaboration?: string;
    }>;
  };
}

export interface AudioSnippetTranscriptBlock {
  type: 'audio_snippet_transcript';
  data: {
    speaker: string;
    startTime: string;
    endTime: string;
    transcriptText: string;
  };
}

// ==========================================
// 2. STEP / PROCESS BLOCKS
// ==========================================

export interface StepListBlock {
  type: 'step_list';
  data: {
    title: string;
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      duration?: string;
      warning?: string;
    }>;
  };
}

export interface NumberedProcessBlock {
  type: 'numbered_process';
  data: {
    processName: string;
    totalPhases: number;
    phases: Array<{
      phaseIndex: number;
      name: string;
      description: string;
      estimatedDays?: number;
    }>;
  };
}

export interface QuickStepsBlock {
  type: 'quick_steps';
  data: {
    title: string;
    summary: string;
    actions: string[];
  };
}

export interface DecisionTreeBlock {
  type: 'decision_tree';
  data: {
    rootQuestion: string;
    nodes: Array<{
      id: string;
      condition: string;
      outcomeIfTrue: string;
      outcomeIfFalse: string;
    }>;
  };
}

export interface FlowchartStepsBlock {
  type: 'flowchart_steps';
  data: {
    workflowName: string;
    nodes: Array<{
      id: string;
      label: string;
      type: 'start' | 'process' | 'decision' | 'end';
      notes?: string;
    }>;
  };
}

export interface TroubleshootingStepsBlock {
  type: 'troubleshooting_steps';
  data: {
    issueCategory: string;
    troubleshootingGrid: Array<{
      symptom: string;
      probableCause: string;
      solution: string;
      urgency: 'low' | 'moderate' | 'urgent';
    }>;
  };
}

// ==========================================
// 3. DATA / TABLE BLOCKS
// ==========================================

export interface KvTableBlock {
  type: 'kv_table';
  data: {
    tableName: string;
    rows: Array<{
      key: string;
      value: string;
      unit?: string;
    }>;
  };
}

export interface ComparisonTableBlock {
  type: 'comparison_table';
  data: {
    title: string;
    headers: string[];
    rows: Array<{
      feature: string;
      values: string[];
    }>;
  };
}

export interface DosageChartBlock {
  type: 'dosage_chart';
  data: {
    productName: string;
    activeIngredient: string;
    dosageRules: Array<{
      target: string;
      dosagePerUnit: string;
      waterRatio?: string;
      applicationMethod: string;
      safetyIntervalDays: number;
    }>;
  };
}

export interface NutrientTableBlock {
  type: 'nutrient_table';
  data: {
    materialName: string;
    nitrogenPercent: number;
    phosphorusPercent: number;
    potassiumPercent: number;
    organicMatterPercent?: number;
    micronutrients?: Array<{
      name: string;
      ppmOrPercent: string;
    }>;
  };
}

export interface CostBreakdownBlock {
  type: 'cost_breakdown';
  data: {
    currency: string;
    landAreaUnit?: string;
    items: Array<{
      category: string;
      item: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
    }>;
    totalExpenditure: number;
  };
}

export interface RoiCalculatorBlock {
  type: 'roi_calculator';
  data: {
    investmentName: string;
    currency: string;
    initialInvestment: number;
    expectedRevenue: number;
    estimatedOperationalCost: number;
    netProfit: number;
    paybackPeriodMonths: number;
    roiPercentage: number;
  };
}

export interface YieldEstimateBlock {
  type: 'yield_estimate';
  data: {
    cropName: string;
    landArea: string;
    minExpectedYield: string;
    maxExpectedYield: string;
    averageYield: string;
    factorsInfluencingYield: string[];
  };
}

export interface MeasurementSpecsBlock {
  type: 'measurement_specs';
  data: {
    title: string;
    measurements: Array<{
      parameter: string;
      value: string;
      optimalRange?: string;
      unit: string;
    }>;
  };
}

export interface SoilTestReportBlock {
  type: 'soil_test_report';
  data: {
    sampleLocation: string;
    phLevel: number;
    ecValue: number;
    organicCarbonPercent: number;
    nitrogenStatus: 'Low' | 'Medium' | 'High';
    phosphorusStatus: 'Low' | 'Medium' | 'High';
    potassiumStatus: 'Low' | 'Medium' | 'High';
    recommendations: string[];
  };
}

export interface FeedConversionRatioBlock {
  type: 'feed_conversion_ratio';
  data: {
    animalType: string;
    fcrRatio: number;
    feedConsumedKg: number;
    weightGainedKg: number;
    periodDays: number;
    benchmarks: string;
  };
}

// ==========================================
// 4. LIST BLOCKS
// ==========================================

export interface BulletInsightsBlock {
  type: 'bullet_insights';
  data: {
    heading: string;
    bullets: string[];
  };
}

export interface ChecklistBlock {
  type: 'checklist';
  data: {
    title: string;
    items: Array<{
      id: string;
      label: string;
      isOptional?: boolean;
      notes?: string;
    }>;
  };
}

export interface ProConListBlock {
  type: 'pro_con_list';
  data: {
    topic: string;
    pros: string[];
    cons: string[];
  };
}

export interface FaqListBlock {
  type: 'faq_list';
  data: {
    faqs: Array<{
      question: string;
      answer: string;
    }>;
  };
}

export interface DoDontListBlock {
  type: 'do_dont_list';
  data: {
    topic: string;
    dos: string[];
    donts: string[];
  };
}

export interface IngredientListBlock {
  type: 'ingredient_list';
  data: {
    recipeName: string;
    yieldVolumeOrWeight: string;
    ingredients: Array<{
      name: string;
      quantity: string;
      purpose?: string;
    }>;
    preparationTime?: string;
  };
}

export interface ToolListBlock {
  type: 'tool_list';
  data: {
    category: string;
    tools: Array<{
      name: string;
      isEssential: boolean;
      estimatedCostRange?: string;
      alternative?: string;
    }>;
  };
}

export interface RequirementListBlock {
  type: 'requirement_list';
  data: {
    title: string;
    requirements: Array<{
      name: string;
      type: 'climate' | 'water' | 'soil' | 'legal' | 'capital';
      isMandatory: boolean;
      description: string;
    }>;
  };
}

export interface OrganicCertChecklistBlock {
  type: 'organic_cert_checklist';
  data: {
    standardName: string;
    criteria: Array<{
      rule: string;
      complianceMethod: string;
      prohibitedInputs: string[];
    }>;
  };
}

// ==========================================
// 5. TIMELINE / CALENDAR BLOCKS
// ==========================================

export interface TimelineBlock {
  type: 'timeline';
  data: {
    title: string;
    events: Array<{
      dateOrPeriod: string;
      title: string;
      description: string;
    }>;
  };
}

export interface SeasonCalendarBlock {
  type: 'season_calendar';
  data: {
    cropName: string;
    seasons: Array<{
      seasonName: string;
      activities: string[];
      keyMilestones: string[];
    }>;
  };
}

export interface GrowthStagesBlock {
  type: 'growth_stages';
  data: {
    subjectName: string;
    stages: Array<{
      stageNumber: number;
      stageName: string;
      durationDays: number;
      keyIndicators: string[];
      careInstructions: string;
    }>;
  };
}

export interface MonthlyPlannerBlock {
  type: 'monthly_planner';
  data: {
    year?: number;
    months: Array<{
      month: string;
      primaryTasks: string[];
      secondaryTasks?: string[];
    }>;
  };
}

export interface HarvestScheduleBlock {
  type: 'harvest_schedule';
  data: {
    cropName: string;
    firstHarvestDays: number;
    harvestWindowDays: number;
    maturityIndicators: string[];
    postHarvestStorageDays: number;
    idealStorageTemp: string;
  };
}

export interface GestationTimelineBlock {
  type: 'gestation_timeline';
  data: {
    animalSpecies: string;
    gestationDaysAvg: number;
    keyMilestones: Array<{
      dayOrWeek: string;
      event: string;
      careRequired: string;
    }>;
  };
}

// ==========================================
// 6. SPECIALIZED AGRICULTURAL BLOCKS
// ==========================================

export interface BreedCardBlock {
  type: 'breed_card';
  data: {
    breedName: string;
    origin: string;
    traits: string[];
    avgWeight: string;
    bestFor: string;
    dailyMilkYieldOrEggCount?: string;
  };
}

export interface DiseaseCardBlock {
  type: 'disease_card';
  data: {
    diseaseName: string;
    scientificName?: string;
    affectedCropsOrAnimals: string[];
    symptoms: string[];
    cause: string;
    organicTreatment: string[];
    chemicalTreatment: string[];
    prevention: string[];
  };
}

export interface PestIdentificationBlock {
  type: 'pest_identification';
  data: {
    pestName: string;
    scientificName?: string;
    damageType: string;
    identifyingFeatures: string[];
    naturalPredators: string[];
    controlThreshold: string;
    recommendedControl: string[];
  };
}

export interface SoilProfileBlock {
  type: 'soil_profile';
  data: {
    soilType: string;
    drainageQuality: 'Poor' | 'Moderate' | 'Good' | 'Excessive';
    idealPhRange: string;
    suitableCrops: string[];
    improvementTips: string[];
  };
}

export interface IrrigationPlanBlock {
  type: 'irrigation_plan';
  data: {
    systemType: 'Drip' | 'Sprinkler' | 'Flood' | 'Subsurface' | 'Rainfed';
    waterRequirementLitersPerDay: number;
    wateringFrequency: string;
    bestTimeOfDay: string;
    moistureMonitoringTip: string;
  };
}

export interface SeedVarietyBlock {
  type: 'seed_variety';
  data: {
    varietyName: string;
    type: 'Heirloom' | 'Hybrid (F1)' | 'Open-Pollinated' | 'GMO';
    daysToMaturity: number;
    diseaseResistance: string[];
    yieldPotential: string;
    seedRatePerAcre: string;
  };
}

export interface FertilizerScheduleBlock {
  type: 'fertilizer_schedule';
  data: {
    cropName: string;
    applications: Array<{
      growthStage: string;
      fertilizerType: string;
      dosagePerAcre: string;
      applicationMethod: string;
    }>;
  };
}

export interface SprayTimingBlock {
  type: 'spray_timing';
  data: {
    targetPestOrDisease: string;
    idealWindSpeedKmh: string;
    idealTempRangeC: string;
    rainfastHours: number;
    recommendedTimeOfDay: 'Early Morning' | 'Late Afternoon' | 'Night';
    ppeRequired: string[];
  };
}

export interface WeatherAdvisoryBlock {
  type: 'weather_advisory';
  data: {
    alertLevel: 'Info' | 'Warning' | 'Severe' | 'Critical';
    weatherCondition: string;
    affectedOperations: string[];
    protectiveMeasures: string[];
    validPeriod: string;
  };
}

export interface CompostRecipeBlock {
  type: 'compost_recipe';
  data: {
    compostType: 'Hot Compost' | 'Vermicomposting' | 'Bokashi' | 'Pit Compost';
    targetCnRatio: string;
    brownsList: string[];
    greensList: string[];
    moistureTargetPercent: string;
    turningFrequencyDays: number;
    readyInWeeks: number;
  };
}

export interface AquaponicsSetupBlock {
  type: 'aquaponics_setup';
  data: {
    fishSpecies: string;
    cropSpecies: string[];
    phTarget: number;
    waterTempRangeC: string;
    stockingDensityKgPerLiter: string;
  };
}

export interface ApicultureHiveCardBlock {
  type: 'apiculture_hive_card';
  data: {
    queenStatus: 'Spotted' | 'Eggs Present' | 'Queenless' | 'Virgin Queen';
    temperament: 'Calm' | 'Aggressive' | 'Moderate';
    broodPattern: 'Solid' | 'Spotty' | 'Low';
    honeyStores: 'Low' | 'Medium' | 'High';
    diseaseOrParasiteObserved: string[];
    actionTaken: string;
  };
}

export interface MushroomFlushingCardBlock {
  type: 'mushroom_flushing_card';
  data: {
    mushroomVariety: string;
    substrateType: string;
    incubationTempC: string;
    fruitingTempC: string;
    relativeHumidityPercent: string;
    expectedFlushes: number;
  };
}

export interface WeedIdentificationBlock {
  type: 'weed_identification';
  data: {
    weedName: string;
    category: 'Broadleaf' | 'Grassy' | 'Sedge';
    reproductionMethod: string;
    competesWithCrops: string[];
    controlMethods: string[];
  };
}

export interface PruningGuideBlock {
  type: 'pruning_guide';
  data: {
    plantType: string;
    bestSeason: string;
    toolRequired: string;
    targetShape: string;
    pruningSteps: string[];
    postPruningCare: string;
  };
}

// ==========================================
// 7. EQUIPMENT / BUSINESS BLOCKS
// ==========================================

export interface MachineSpecsBlock {
  type: 'machine_specs';
  data: {
    machineName: string;
    manufacturer?: string;
    horsepower: number;
    fuelConsumptionLitersPerHour: string;
    compatibleImplements: string[];
    idealOperationSpeedKmh: string;
  };
}

export interface MaintenanceChecklistBlock {
  type: 'maintenance_checklist';
  data: {
    equipmentName: string;
    intervalHoursOrMonths: string;
    tasks: Array<{
      component: string;
      action: 'Check' | 'Clean' | 'Replace' | 'Grease' | 'Calibrate';
      specification?: string;
    }>;
  };
}

export interface MarketPriceBlock {
  type: 'market_price';
  data: {
    commodityName: string;
    marketName: string;
    pricePerUnit: string;
    currency: string;
    priceTrend: 'Up' | 'Down' | 'Stable';
    dateUpdated: string;
    qualityGrade: string;
  };
}

export interface SubsidyInfoBlock {
  type: 'subsidy_info';
  data: {
    schemeName: string;
    offeringAuthority: string;
    subsidyPercentage: number;
    maxSubsidyAmount?: string;
    eligibilityCriteria: string[];
    requiredDocuments: string[];
  };
}

export interface BusinessPlanSummaryBlock {
  type: 'business_plan_summary';
  data: {
    farmBusinessTitle: string;
    targetMarket: string;
    revenueStreams: string[];
    estimatedCapEx: string;
    estimatedOpExAnnual: string;
    breakevenTimelineMonths: number;
    keyRisks: string[];
  };
}

export interface InvestmentTableBlock {
  type: 'investment_table';
  data: {
    currency: string;
    capexItems: Array<{ item: string; cost: number }>;
    opexItems: Array<{ item: string; annualCost: number }>;
    totalInitialCapitalRequired: number;
  };
}

export interface LoanCalculatorBlock {
  type: 'loan_calculator';
  data: {
    loanSchemeName: string;
    principalAmount: number;
    annualInterestRatePercent: number;
    tenureYears: number;
    estimatedMonthlyEmi: number;
    totalInterestPayable: number;
    subsidizedInterestRatePercent?: number;
  };
}

// ==========================================
// 8. ALERT / VISUAL BLOCKS
// ==========================================

export interface WarningBoxBlock {
  type: 'warning_box';
  data: {
    title: string;
    message: string;
    hazardLevel: 'Caution' | 'Danger' | 'Toxic';
    safetyGearRequired?: string[];
  };
}

export interface TipBoxBlock {
  type: 'tip_box';
  data: {
    title?: string;
    tip: string;
    category?: string;
  };
}

export interface SuccessBoxBlock {
  type: 'success_box';
  data: {
    title: string;
    achievement: string;
    metric?: string;
  };
}

export interface InfoBoxBlock {
  type: 'info_box';
  data: {
    title?: string;
    content: string;
  };
}

export interface MetricRowBlock {
  type: 'metric_row';
  data: {
    metrics: Array<{
      label: string;
      value: string;
      unit?: string;
      changePercentage?: number;
      isPositiveChange?: boolean;
    }>;
  };
}

export interface StatHighlightBlock {
  type: 'stat_highlight';
  data: {
    bigStat: string;
    statLabel: string;
    subtext?: string;
    accentColor?: string;
  };
}

export interface BadgeRowBlock {
  type: 'badge_row';
  data: {
    badges: Array<{
      label: string;
      variant?: 'success' | 'warning' | 'info' | 'neutral';
    }>;
  };
}

export interface SeparatorBlock {
  type: 'separator';
  data: {
    label?: string;
    style?: 'solid' | 'dashed' | 'dotted';
  };
}

// ==========================================
// DISCRIMINATED UNION — ALL 68 BLOCK TYPES
// ==========================================

export type AgriUIBlock =
  | HeroSummaryBlock
  | QuoteHighlightBlock
  | FunFactBlock
  | VideoContextBlock
  | NarratorNoteBlock
  | KeyTakeawaysBlock
  | AudioSnippetTranscriptBlock
  | StepListBlock
  | NumberedProcessBlock
  | QuickStepsBlock
  | DecisionTreeBlock
  | FlowchartStepsBlock
  | TroubleshootingStepsBlock
  | KvTableBlock
  | ComparisonTableBlock
  | DosageChartBlock
  | NutrientTableBlock
  | CostBreakdownBlock
  | RoiCalculatorBlock
  | YieldEstimateBlock
  | MeasurementSpecsBlock
  | SoilTestReportBlock
  | FeedConversionRatioBlock
  | BulletInsightsBlock
  | ChecklistBlock
  | ProConListBlock
  | FaqListBlock
  | DoDontListBlock
  | IngredientListBlock
  | ToolListBlock
  | RequirementListBlock
  | OrganicCertChecklistBlock
  | TimelineBlock
  | SeasonCalendarBlock
  | GrowthStagesBlock
  | MonthlyPlannerBlock
  | HarvestScheduleBlock
  | GestationTimelineBlock
  | BreedCardBlock
  | DiseaseCardBlock
  | PestIdentificationBlock
  | SoilProfileBlock
  | IrrigationPlanBlock
  | SeedVarietyBlock
  | FertilizerScheduleBlock
  | SprayTimingBlock
  | WeatherAdvisoryBlock
  | CompostRecipeBlock
  | AquaponicsSetupBlock
  | ApicultureHiveCardBlock
  | MushroomFlushingCardBlock
  | WeedIdentificationBlock
  | PruningGuideBlock
  | MachineSpecsBlock
  | MaintenanceChecklistBlock
  | MarketPriceBlock
  | SubsidyInfoBlock
  | BusinessPlanSummaryBlock
  | InvestmentTableBlock
  | LoanCalculatorBlock
  | WarningBoxBlock
  | TipBoxBlock
  | SuccessBoxBlock
  | InfoBoxBlock
  | MetricRowBlock
  | StatHighlightBlock
  | BadgeRowBlock
  | SeparatorBlock;

// Helper: All block type names for validation
export const ALL_BLOCK_TYPES = [
  'hero_summary', 'quote_highlight', 'fun_fact', 'video_context', 'narrator_note',
  'key_takeaways', 'audio_snippet_transcript',
  'step_list', 'numbered_process', 'quick_steps', 'decision_tree', 'flowchart_steps', 'troubleshooting_steps',
  'kv_table', 'comparison_table', 'dosage_chart', 'nutrient_table', 'cost_breakdown',
  'roi_calculator', 'yield_estimate', 'measurement_specs', 'soil_test_report', 'feed_conversion_ratio',
  'bullet_insights', 'checklist', 'pro_con_list', 'faq_list', 'do_dont_list',
  'ingredient_list', 'tool_list', 'requirement_list', 'organic_cert_checklist',
  'timeline', 'season_calendar', 'growth_stages', 'monthly_planner', 'harvest_schedule', 'gestation_timeline',
  'breed_card', 'disease_card', 'pest_identification', 'soil_profile', 'irrigation_plan',
  'seed_variety', 'fertilizer_schedule', 'spray_timing', 'weather_advisory',
  'compost_recipe', 'aquaponics_setup', 'apiculture_hive_card', 'mushroom_flushing_card',
  'weed_identification', 'pruning_guide',
  'machine_specs', 'maintenance_checklist', 'market_price', 'subsidy_info',
  'business_plan_summary', 'investment_table', 'loan_calculator',
  'warning_box', 'tip_box', 'success_box', 'info_box',
  'metric_row', 'stat_highlight', 'badge_row', 'separator',
] as const;
