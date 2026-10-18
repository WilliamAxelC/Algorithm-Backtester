import { getFullDatasetForAsset } from './market-data-provider';

export const HNT_SCHEMATIC_2_DATASET = getFullDatasetForAsset('HNTUSDTPERP');
export const HNT_SCHEMATIC_1_DATASET = getFullDatasetForAsset('BTCUSDT');
export const BUILT_IN_DATASETS = [HNT_SCHEMATIC_2_DATASET, HNT_SCHEMATIC_1_DATASET];
