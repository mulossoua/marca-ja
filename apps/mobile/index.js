import { registerRootComponent } from "expo";
import App from "./App";

// Não usar "expo/AppEntry" directamente: esse ficheiro assume que App.js está
// ao lado de node_modules/expo, o que não é verdade neste monorepo (o pacote
// "expo" fica no node_modules da raiz do workspace, não em apps/mobile).
registerRootComponent(App);
