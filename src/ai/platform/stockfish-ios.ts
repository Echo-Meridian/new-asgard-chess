// stockfish-ios.ts
import { NativeModules } from 'react-native';
const { StockfishModule } = NativeModules;

export class StockfishIOS {
  async init(): Promise<boolean> {
    return await StockfishModule.initEngine();
  }
  
  async setPosition(fen: string): Promise<void> {
    await StockfishModule.setPosition(fen);
  }
  
  async getBestMove(config: StockfishConfig): Promise<string> {
    return await StockfishModule.getBestMove(config.depth, config.time);
  }
  
  async analyzePosition(config: StockfishConfig): Promise<MoveAnalysis> {
    return await StockfishModule.analyzePosition(config.depth, config.time);
  }
  
  async setSkillLevel(elo: number): Promise<void> {
    await StockfishModule.setSkillLevel(elo);
  }
  
  dispose(): void {
    StockfishModule.dispose();
  }
}