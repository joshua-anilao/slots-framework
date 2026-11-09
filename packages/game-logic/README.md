# @slots/game-logic

Shared **Models** and **Controllers** (the M and C of MVC) plus **service interfaces**. Both the HTML prototype and Cocos use this package; each only writes its own **Views**.

```ts
import { createLocalGame } from '@slots/game-logic';
const game = createLocalGame({ config, balance: 10000, presenter: myReelView, debug: true });
game.models.wallet.balance.subscribe(v => balanceLabel.text = format(v));
spinButton.onClick = () => game.controllers.spin.spinOnce();
```

## Pieces

| Kind | Name | Job |
|---|---|---|
| Model | `WalletModel`, `BetModel`, `SpinModel`, `AutoSpinModel`, `SpeedModel` | Observable state for the UI |
| Controller | `SpinController` | Spin flow: idle → requesting → presenting → idle; takes the bet, asks the service, waits for the view, shows the final balance, publishes win tiers |
| Controller | `AutoSpinController` | Count + stop conditions (feature, single win ≥, balance drop ≥) |
| Controller | `BetController`, `SpeedController`, `BuyBonusController` | Bet up/down (blocked mid-round), turbo cycle, buy price and quantity |
| View contract | `IRoundPresenter` | What a view implements to play a round back |
| Service | `ISpinService` → `LocalSpinService` | Runs math-core like a server: wallet, round id, history |
| Service | `IWalletService`, `IHistoryService`, `IWinFeedService`, `IConfigService` | Balance, bet history, winner ticker, config + debug overrides |
| Events | `EventBus` / `GameEvents` | spinStarted, spinResolved, winTier, freeSpinsTriggered, insufficientFunds, autoSpinStopped, ... |

## Going to a real server later

Write `RemoteSpinService` (and remote wallet/history/feed) that implement the same interfaces, and a `createRemoteGame` that wires them. Models, controllers and views stay the same.

`SimulatedWinFeedService` invents winners for demos and marks each item `simulated: true`. Production must use real wins.
