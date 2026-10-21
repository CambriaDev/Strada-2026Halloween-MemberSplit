# MemberSplit 随机分组逻辑详解

本文档描述 MemberSplit 当前版本的随机分组算法，包括可复现随机键、角色分配、人数补偿、排序、动画顺序、导出顺序以及边界情况证明。

适用版本：MemberSplit v1.2 · Strada Halloween Edition

实现位置：`src/app.js` 中的 `hashString`、`seedKey`、`orderBySeed`、`seedCoin`、`getValidation`、`buildPlan`、`startGrouping`、`appendMemberCard`、`exportRows`。

---

## 1. 设计目标

分组算法同时满足以下要求：

1. **可复现**：同一批人（姓名和角色相同）使用同一个种子，必定得到完全相同的分组结果。
2. **与名单行顺序无关**：Excel 中的行顺序、倒序或交错顺序不会改变结果。
3. **角色约束**：
   - Team Lead 至少 2 名，两队 Lead 人数差不超过 1。
   - SME 至少 2 名，两队 SME 人数差不超过 1。
4. **人数平衡**：在角色约束允许的范围内尽量均分，最终两队总人数差为 0 或 1。
5. **角色优先展示**：结果中 Lead 在最前，SME 其次，普通成员最后。
6. **纯颜色标识**：界面不显示 “Team Lead / SME” 文字，金色代表 Team Lead，紫色代表 SME，中性色代表普通成员。

算法不使用“按行号洗牌”或“顺序 PRNG 流”，而是为每个人生成一个由 **种子 + 姓名 + 用途标签** 决定的稳定哈希键。这样即使名单行顺序变化，同一个人在同一个角色池中的相对位置也不会变。

---

## 2. 输入与前置条件

### 2.1 输入

- `participants`：成员数组，每项包含：
  - `name`：姓名，参与随机键计算。
  - `role`：`lead`、`sme` 或 `member`。
  - `id`：本次会话内的唯一标识，仅用于分组映射。
- `seedUsed`：实际使用的种子字符串。
- `seedWasBlank`：种子输入是否为空（仅用于展示和导出说明）。

### 2.2 角色数量校验

`getValidation()` 在开始分组前检查：

```text
总人数 n >= 4
Lead 人数 L >= 2
SME 人数 S >= 2
普通成员人数 M >= 0
```

其中 4 人是最小可行名单：2 名 Lead + 2 名 SME，且没有普通成员。普通成员数量没有下限，角色数量没有上限。

### 2.3 种子规则

- 默认种子是当天的 `yyMMdd`，例如 2026 年 10 月 22 日为 `261022`。
- 种子可以输入任意字符串。
- 如果种子输入留空，开始分组时使用当前 **毫秒时间戳**（`Date.now()`），并在结果区和导出信息中显示实际种子。
- 「换一组」会生成新的毫秒时间戳种子。
- 「重新分组」沿用当前种子，因此会复现同一结果。
- 种子按钮：
  - 日期按钮：恢复为当天 `yyMMdd`。
  - 骰子按钮：生成 8 位随机数字种子。

种子只影响随机键；队伍名称、动画速率、颜色主题、导入文件名等都不参与随机。

---

## 3. 记号

| 记号 | 含义 |
| --- | --- |
| `L` | Team Lead 总人数 |
| `S` | SME 总人数 |
| `M` | 普通成员总人数 |
| `T` | 总人数，`T = L + S + M` |
| `A` / `F` | 两支队伍，代码中用索引 `0` / `1` 表示 |
| `leadCountA` | 分到 A 队的 Lead 人数 |
| `smeCountA` | 分到 A 队的 SME 人数 |
| `baseA` | A 队的角色基础人数，`leadCountA + smeCountA` |
| `baseF` | F 队的角色基础人数 |
| `targetA` | 补偿后希望 A 队达到的总人数 |

---

## 4. 可复现随机：哈希与稳定键

### 4.1 32 位哈希

`hashString(str)` 使用 FNV-1a 风格的 32 位累积，再做三轮雪崩混合：

```js
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
```

输出是 `0` 到 `2^32 - 1` 的整数。

### 4.2 姓名键

```js
function seedKey(seed, salt, name) {
  return hashString(`${seed}\u0000${salt}\u0000${name}`);
}
```

`\u0000`（NUL）作为分隔符，避免 `seed + salt + name` 直接拼接产生歧义。

用途标签 `salt` 决定同一个姓名在不同步骤中获得不同随机键：

| salt | 用途 |
| --- | --- |
| `lead` | Lead 角色池排序 |
| `sme` | SME 角色池排序 |
| `member` | 普通成员角色池排序 |
| `lead-split` | 决定哪一个队获得多出的 Lead |
| `sme-split` | 决定哪一个队获得多出的 SME（非双奇数时） |
| `odd-extra` | 总人数为奇数时，决定哪一队多一个总名额 |
| `member-fill` | 普通成员补偿分配顺序 |
| `reveal-member` | 动画中普通成员的揭晓顺序 |
| `reveal-sme` | 动画中 SME 的揭晓顺序 |
| `reveal-lead` | 动画中 Lead 的揭晓顺序 |

同一个姓名在同一 salt 下永远得到同一个键；改变种子或改名都会改变键。

### 4.3 按种子排序

```js
function orderBySeed(pool, seed, salt) {
  return pool.slice().sort((a, b) => {
    const diff = seedKey(seed, salt, a.name) - seedKey(seed, salt, b.name);
    if (diff) return diff;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}
```

规则：

1. 按 32 位哈希键升序排列。
2. 哈希碰撞时按姓名字符串比较作为稳定兜底。
3. 完全同名的人键相同、姓名也相同，在输出中不可区分。

### 4.4 种子硬币

```js
function seedCoin(seed, label) {
  return (hashString(`${seed}\u0000${label}`) & 1) === 1;
}
```

取哈希最低位作为布尔值，用于在“哪一队获得多出的名额”之间做可复现选择。

---

## 5. 角色池排序

分组开始时，三个角色池分别独立排序：

```js
leads   = orderBySeed(participants.filter(p => p.role === 'lead'),   seed, 'lead');
smes    = orderBySeed(participants.filter(p => p.role === 'sme'),    seed, 'sme');
members = orderBySeed(participants.filter(p => p.role === 'member'), seed, 'member');
```

三个池使用不同 salt，因此 Lead、SME、普通成员各自独立排序，互不干扰。

---

## 6. 角色分配

### 6.1 Lead 分配

```js
leadExtraA = seedCoin(seed, 'lead-split');
leadCountA = floor(L / 2) + (L % 2 === 1 && leadExtraA ? 1 : 0);
leadCountF = L - leadCountA;
```

- `L` 为偶数：两队各 `L / 2` 名 Lead。
- `L` 为奇数：基础各 `floor(L / 2)` 名；多出的一名由 `lead-split` 硬币决定给 A 还是 F。

分配时，已排序的 `leads` 前 `leadCountA` 人进入 A，其余进入 F。

### 6.2 SME 分配

SME 的分配与 Lead 的奇偶性协同：

```js
smeExtraA = (L % 2 === 1 && S % 2 === 1)
  ? !leadExtraA
  : seedCoin(seed, 'sme-split');

smeCountA = floor(S / 2) + (S % 2 === 1 && smeExtraA ? 1 : 0);
smeCountF = S - smeCountA;
```

- `S` 为偶数：两队各 `S / 2` 名 SME。
- `S` 为奇数，且 `L` 为偶数：多出的一名由 `sme-split` 硬币决定。
- `S` 为奇数，且 `L` 也为奇数：Lead 和 SME 的“多出名额”必须分给相反队伍，即 `smeExtraA = !leadExtraA`。这样可以避免两个多出名额叠加到同一队，使角色基础人数差从 2 降为 0。

奇偶性总结：

| L 奇偶 | S 奇偶 | Lead 额外名额 | SME 额外名额 | 角色基础人数差 |
| --- | --- | --- | --- | --- |
| 偶数 | 偶数 | 无 | 无 | 0 |
| 奇数 | 偶数 | 由 `lead-split` 决定 | 无 | 1 |
| 偶数 | 奇数 | 无 | 由 `sme-split` 决定 | 1 |
| 奇数 | 奇数 | 由 `lead-split` 决定 | 给相反队伍 | 0 |

因此角色基础人数差始终为 **0 或 1**。

### 6.3 分配顺序

```js
leads.forEach((p, i) => teamOf.set(p.id, i < leadCountA ? 0 : 1));
smes.forEach((p, i)  => teamOf.set(p.id, i < smeCountA  ? 0 : 1));
```

具体是哪几个人进入哪一队，由角色池内的种子排序决定；哪一队获得多出的名额，由硬币决定。

---

## 7. 总人数补偿

角色分配完成后：

```js
baseA = leadCountA + smeCountA;
baseF = leadCountF + smeCountF;
```

`baseA + baseF = L + S`，剩下 `M` 名普通成员用于补偿总人数。

### 7.1 目标人数

```js
targetA = floor(T / 2) + (T % 2 === 1 && seedCoin(seed, 'odd-extra') ? 1 : 0);
targetA = max(baseA, min(T - baseF, targetA));
```

解释：

- `T` 为偶数：目标 A 为 `T / 2`。
- `T` 为奇数：基础目标为 `floor(T / 2)`；多出的一个总名额由 `odd-extra` 硬币决定给 A 还是 F。
- 下限 `baseA`：A 队已有的角色人数不能被移走。
- 上限 `T - baseF`：F 队已有的角色人数不能被移走，A 最多只能拿到剩余名额。

### 7.2 普通成员落位

```js
memberOrder = orderBySeed(members, seed, 'member-fill');
needA = targetA - baseA;
memberOrder.forEach((p, i) => teamOf.set(p.id, i < needA ? 0 : 1));
```

- 普通成员按 `member-fill` 的种子顺序排列。
- 前 `needA` 人进入 A，其余进入 F。
- 由于 `targetA` 已夹在 `[baseA, T - baseF]` 之间，`needA` 一定在 `0..M` 范围内。

### 7.3 最终人数

```text
A 队人数 = targetA
F 队人数 = T - targetA
```

---

## 8. 不变量与证明

### 8.1 所有人都被分配且只分配一次

- Lead、SME、普通成员三个池互斥且覆盖所有参与者。
- 每个池按人数切分后，所有人都获得一个队伍索引。
- `teamOf` 以 `id` 为键，不会重复落位。

### 8.2 Lead 人数差 ≤ 1

`leadCountA` 和 `leadCountF` 是 `L` 的向下取整与向上取整组合，差值只能是 0 或 1。

### 8.3 SME 人数差 ≤ 1

同理，`smeCountA` 和 `smeCountF` 是 `S` 的向下取整与向上取整组合，差值只能是 0 或 1。

### 8.4 每队至少有 1 名 Lead 和 1 名 SME

因为 `L >= 2`、`S >= 2`，且两队同类角色人数差 ≤ 1，所以每队至少分到 `floor(2 / 2) = 1` 名 Lead 和 1 名 SME。

### 8.5 总人数差 ≤ 1

- `baseA - baseF` 只能是 -1、0 或 1。
- 如果没有触发夹逼，`targetA` 是 `floor(T / 2)` 或 `ceil(T / 2)`，最终差值 0 或 1。
- 如果触发下夹逼（`targetA < baseA`）：
  - 由于 `targetA` 至少是 `floor(T / 2)`，可得 `baseA > floor(T / 2)`。
  - 又因为 `baseA - baseF <= 1`，有 `T = baseA + baseF + M >= 2 * baseA - 1 + M`。
  - 若 `M >= 1`，则 `T >= 2 * baseA`，`floor(T / 2) >= baseA`，与 `baseA > floor(T / 2)` 矛盾。
  - 因此只有 `M = 0` 时可能发生，此时 `baseA` 是向上取整的一侧，最终差值正好为 1。
- 上夹逼同理。

所以最终总人数差恒为 **0 或 1**。

代码中的 `checks.balance` 使用 `diff <= 3` 作为宽松的安全断言；实际构造目标严格为 0 或 1，测试也按 ≤ 1 验证。

---

## 9. 展示、动画与导出顺序

### 9.1 队伍数组与导出顺序

分组完成后，`teamA` 和 `teamF` 分别按以下规则排序：

```js
ROLE_RANK = { lead: 0, sme: 1, member: 2 };
sorter = (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]
  || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
```

即：

1. Lead 在最前。
2. SME 其次。
3. 普通成员最后。
4. 同一角色内按姓名（JavaScript UTF-16 字符串比较）升序。

这个顺序用于导出，因此导出的每一列都自动满足“Lead 在前、SME 其次、普通成员最后”。

### 9.2 看板展示

- Lead 卡片放在队伍顶部的独立 Lead 区域，可以堆叠多张。
- SME 卡片和普通成员卡片放在成员列表中。
- 插入成员卡片时按 `ROLE_RANK` 找到第一个角色优先级更低的卡片，插在它之前；因此 SME 始终排在普通成员之前。
- 角色只用颜色区分：
  - 金色 = Team Lead
  - 紫色 = SME
  - 中性色 = 普通成员
- 同一角色内部的具体先后由落位/揭晓顺序决定，不影响队伍成员和导出结果。

### 9.3 动画揭晓顺序

动画顺序与最终展示顺序不同，使用独立的 salt：

```text
普通成员（reveal-member）
→ SME（reveal-sme）
→ Team Lead（reveal-lead）
```

每个池内部同样按种子 + 姓名排序。Lead 最后揭晓是为了动画效果；揭晓完成后，Lead 会显示在队伍顶部。

### 9.4 导出格式

「分组结果」工作表/CSV：

```text
第一列：Team A 姓名
第二列：空白分隔列
第三列：Team F 姓名
```

- 不包含表头。
- 不包含角色列。
- 两队人数不同时，较短一队在末尾留空。
- 每组姓名内部顺序为 Lead → SME → 普通成员 → 姓名升序。

「分组信息」工作表保留队名、人数、角色人数、种子、来源和约束等元数据。

---

## 10. 完整伪代码

```js
function buildPlan(participants, seedUsed, seedWasBlank) {
  const seed = String(seedUsed);
  const leads   = orderBySeed(filter(participants, 'lead'),   seed, 'lead');
  const smes    = orderBySeed(filter(participants, 'sme'),    seed, 'sme');
  const members = orderBySeed(filter(participants, 'member'), seed, 'member');

  if (leads.length < 2 || smes.length < 2) throw new Error('角色数量不符合要求');

  const L = leads.length;
  const S = smes.length;
  const T = participants.length;

  // 1. Lead 均分
  const leadExtraA = seedCoin(seed, 'lead-split');
  const leadCountA = Math.floor(L / 2) + (L % 2 === 1 && leadExtraA ? 1 : 0);
  const leadCountF = L - leadCountA;

  // 2. SME 均分；双奇数时把额外名额分给相反队伍
  const smeExtraA = (L % 2 === 1 && S % 2 === 1)
    ? !leadExtraA
    : seedCoin(seed, 'sme-split');
  const smeCountA = Math.floor(S / 2) + (S % 2 === 1 && smeExtraA ? 1 : 0);
  const smeCountF = S - smeCountA;

  // 3. 按排序结果落位
  const teamOf = new Map();
  leads.forEach((p, i) => teamOf.set(p.id, i < leadCountA ? 0 : 1));
  smes.forEach((p, i)  => teamOf.set(p.id, i < smeCountA  ? 0 : 1));

  // 4. 计算角色基础人数
  const baseA = leadCountA + smeCountA;
  const baseF = leadCountF + smeCountF;

  // 5. 目标总人数与夹逼
  let targetA = Math.floor(T / 2) + (T % 2 === 1 && seedCoin(seed, 'odd-extra') ? 1 : 0);
  targetA = Math.max(baseA, Math.min(T - baseF, targetA));

  // 6. 普通成员补偿
  const memberOrder = orderBySeed(members, seed, 'member-fill');
  const needA = targetA - baseA;
  memberOrder.forEach((p, i) => teamOf.set(p.id, i < needA ? 0 : 1));

  // 7. 生成队伍并排序
  const teamA = participants.filter(p => teamOf.get(p.id) === 0);
  const teamF = participants.filter(p => teamOf.get(p.id) === 1);
  const sorter = (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]
    || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  teamA.sort(sorter);
  teamF.sort(sorter);

  // 8. 独立生成动画揭晓顺序
  const revealOrder = [
    ...orderBySeed(members, seed, 'reveal-member'),
    ...orderBySeed(smes, seed, 'reveal-sme'),
    ...orderBySeed(leads, seed, 'reveal-lead')
  ].map(p => ({ person: p, team: teamOf.get(p.id) }));

  return { seedUsed, seedWasBlank, teamA, teamF, revealOrder };
}
```

---

## 11. 示例

以下示例假设硬币结果已给定，用于说明数值变化；实际结果由种子决定。

### 示例 1：28 人，2 Lead / 5 SME / 21 Member

`L = 2, S = 5, M = 21, T = 28`

- Lead：`2 / 2` → 每队 1 名。
- SME：`5` 为奇数，`sme-split` 决定 A 得 3 或 2。
  - 若 A 得 3：`baseA = 1 + 3 = 4`，`baseF = 1 + 2 = 3`。
  - 若 A 得 2：`baseA = 3`，`baseF = 4`。
- `T = 28` 为偶数，`targetA = 14`，未触发夹逼。
- 普通成员补偿：
  - `baseA = 4` 时 `needA = 10`，A 得 10 名成员，F 得 11 名。
  - `baseA = 3` 时 `needA = 11`，A 得 11 名成员，F 得 10 名。
- 最终两队均为 **14 / 14**。

### 示例 2：6 人，3 Lead / 3 SME / 0 Member

`L = 3, S = 3, M = 0, T = 6`

- Lead 和 SME 都是奇数，额外名额分给相反队伍。
- 若 `leadExtraA = true`：
  - `leadCountA = 2`，`leadCountF = 1`。
  - `smeExtraA = false`，`smeCountA = 1`，`smeCountF = 2`。
  - `baseA = 3`，`baseF = 3`。
- 若 `leadExtraA = false`：
  - `leadCountA = 1`，`leadCountF = 2`。
  - `smeExtraA = true`，`smeCountA = 2`，`smeCountF = 1`。
  - `baseA = 3`，`baseF = 3`。
- 最终 **3 / 3**，Lead 和 SME 分别都是 **2/1** 或 **1/2**。

如果两个额外名额都分给同一队，就会出现 4/2；协同规则避免了这种情况。

### 示例 3：11 人，5 Lead / 4 SME / 2 Member

`L = 5, S = 4, M = 2, T = 11`

- Lead：`5` 为奇数，`lead-split` 决定 A 得 3 或 2。
- SME：`4` 为偶数，每队 2 名。
- 角色基础人数：
  - 若 A 得 3 Lead：`baseA = 5`，`baseF = 4`。
  - 若 A 得 2 Lead：`baseA = 4`，`baseF = 5`。
- `T = 11` 为奇数，`targetA = 5` 或 `6`，再夹在 `[baseA, 11 - baseF]` 内。
- 最终只能是 **5 / 6** 或 **6 / 5**，总人数差 1。

### 示例 4：5 人，2 Lead / 3 SME / 0 Member

`L = 2, S = 3, M = 0, T = 5`

- Lead：每队 1 名。
- SME：`sme-split` 决定 A 得 2 或 1。
- 角色基础人数为 `3 / 2` 或 `2 / 3`。
- 没有普通成员可补偿，夹逼后最终为 **3 / 2** 或 **2 / 3**，差 1。

### 示例 5：13 人，4 Lead / 9 SME / 0 Member

`L = 4, S = 9, M = 0, T = 13`

- Lead：每队 2 名。
- SME：`sme-split` 决定 A 得 5 或 4。
- 角色基础人数为 `7 / 6` 或 `6 / 7`。
- 无普通成员，夹逼后最终为 **7 / 6** 或 **6 / 7**，差 1。

---

## 12. 可复现规则与影响因素

### 12.1 结果相同的条件

以下条件同时满足时，分组结果完全相同：

- 成员姓名集合相同；
- 每个成员的角色相同；
- 使用的种子相同。

名单行顺序、导入文件格式（xlsx / xls / csv）、工作表、起始行、队名、动画速率、界面主题都不影响结果。

### 12.2 会改变结果的操作

- 修改种子。
- 修改任意成员的角色（角色池变化）。
- 重命名成员（姓名键变化）。
- 增删成员（人数、角色池和补偿顺序变化）。
- 将种子留空后重新开始（使用新的毫秒时间戳）。

### 12.3 重复姓名

随机键只使用姓名，不使用行号或 ID。因此：

- 两个完全同名、同角色的人会得到相同键；
- 排序时按姓名兜底，二者在输出中不可区分；
- 建议名单中避免重复姓名，或至少在姓名后加区分后缀。

### 12.4 哈希碰撞

32 位哈希存在碰撞可能。碰撞时：

- 排序使用姓名比较兜底，结果仍然确定；
- 硬币碰撞只影响“哪一队多一人”，不会破坏约束；
- 对活动分组场景，碰撞概率足够低，且不影响约束正确性。

---

## 13. 复杂度与边界

- 哈希：每个姓名在每个 salt 下计算一次，复杂度与姓名长度线性相关。
- 排序：三个角色池分别排序，整体 `O(n log n)`。
- 分配与补偿：`O(n)`。
- 内存：`O(n)`。
- 导入上限：单表最多读取前 5000 行、64 列。
- 最小名单：4 人（2 Lead + 2 SME）。
- 最大人数：受导入上限和浏览器性能限制，算法本身没有额外上限。

---

## 14. 测试覆盖

- `test/full.cjs`：端到端验证角色约束、人数平衡、颜色展示、导出布局、种子默认值、复现性和不同种子的差异性。
- `test/stress.cjs`：7 组配置 × 8 个种子 = 56 次抽取，覆盖 4 至 50 人、2 至 7 名 Lead、2 至 15 名 SME，验证：
  - 每队至少 1 名 Lead；
  - 两队 Lead 人数差 ≤ 1；
  - 两队 SME 人数差 ≤ 1；
  - 总人数差 ≤ 1；
  - 所有成员唯一且全部落位。
- `test/order.cjs`：同一批人按正序、倒序、交错顺序导入，验证结果完全一致；改名会改变结果。
- `test/extra.cjs`：偏移表格、剪贴板、XSS、移动端等补充验证。

运行：

```bash
npm test
```

---

## 15. 常见问题

### 为什么不用 Fisher-Yates 洗牌？

Fisher-Yates 依赖名单顺序和 PRNG 调用顺序，名单行顺序变化会改变结果。本工具需要“同一批人、同一角色、同一种子 → 相同结果”，因此使用姓名键排序，而不是按行号洗牌。

### 为什么 Lead 在动画里最后揭晓，却显示在最前面？

动画顺序和展示顺序是两套独立逻辑：

- 动画为了节奏，Lead 最后揭晓；
- 最终看板和导出按角色优先级排序，Lead 在最前。

### 为什么两队人数不能永远完全相等？

当总人数为奇数、或角色基础人数本身为奇数且没有足够的普通成员补偿时，人数差只能是 1。算法保证差值不超过 1。

### 为什么改变队名不会改变分组？

队名只用于展示、文件名和导出信息，不参与任何哈希或排序。

### 种子留空时为什么每次结果不同？

留空会在点击「开始分组」时生成新的毫秒时间戳种子。若希望复现，请填写固定种子；「重新分组」会沿用当前种子。

### 这个随机算法安全吗？

不安全，也不需要安全。它用于活动分组，目标是可复现和分布均匀，不是密码学随机数生成器。
