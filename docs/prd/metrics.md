# 租务管家AM NFC考勤系统 - 业务指标与晋降级规则

> 文档版本: v2.0
> 更新日期: 2025-04-04
> 对齐制度: 2025年Q4季度租住服务中心租务管家AM晋降级考核规则
> 适用范围: 租务管家业务部租务管家AM（不含省心租资管）

---

## 1. 评分公式与排名逻辑

### 1.1 核心公式

```
月度得分 = 系数A百分位排名 × 30 + 系数C百分位排名 × 70
季度得分 = 季度内各月度得分的均值
```

### 1.2 排名规则

- **AM通排**：所有AM职级（S1/A/M等）统一排名，不按职级分组
- 排名基于百分位（0-100），数值越高越好
- 数据口径以绩效核对口径为准

### 1.3 指标总览

```
┌─────────────────────────────────────────────────────────────────┐
│                     月度得分 (百分位排名制)                       │
├──────────────────────────┬──────────────────────────────────────┤
│   系数A排名 × 30         │        系数C排名 × 70                │
│   (租务量)               │        (重点业务目标达成)              │
├──────────────────────────┴──────────────────────────────────────┤
│   系数B ≥ 1 (底线指标，不参与计分，仅作为升级前提条件)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 系数A：租务量（排名权重30）

### 2.1 定义

反映租务管家带看业务的**真实性**和**数量**。

### 2.2 计算规则

```
系数A = (NFC验证通过带看次数 / 申报带看总次数) × (实际带看次数 / 目标带看次数)

其中:
- NFC验证通过: GPS距离<100m + 带看时长≥5分钟
- 验证通过率 ≥ 70% 为达标，< 70% 系数打5折
```

### 2.3 目标值设定（参考Q4规则）

| 职级 | 月度目标 | 季度目标 |
|------|---------|---------|
| S1级 | 8套 | 24套 |
| A级 | 12套 | 36套 |
| M级 | 15套 | 45套 |

### 2.4 数据来源

| 数据项 | 来源 | 计算方式 |
|-------|------|---------|
| 申报带看次数 | 业务系统 | 客户预约记录 |
| NFC验证通过次数 | 考勤系统 | CHECK_IN类型打卡记录 |
| 带看时长 | 考勤系统 | CHECK_OUT - CHECK_IN |

### 2.5 单次带看质量评分

```javascript
// 单次带看质量评分 (0-150分)
function calculateShowingQuality(record) {
  let score = 100;
  
  // NFC验证 (+30分)
  if (record.nfc_verified) score += 30;
  
  // GPS距离评分 (+20分)
  const distance = record.distance_meters;
  if (distance < 50) score += 20;
  else if (distance < 100) score += 10;
  else score -= 20;
  
  // 带看时长评分 (+30分)
  const duration = record.duration_minutes;
  if (duration >= 20) score += 30;
  else if (duration >= 10) score += 20;
  else if (duration >= 5) score += 10;
  else score -= 10;
  
  // 照片完整性 (+20分)
  if (record.photos?.length >= 2) score += 20;
  
  return Math.min(150, Math.max(0, score));
}
```

---

## 3. 系数B：基础业务达成（底线指标，不计入得分）

### 3.1 定义

反映租务管家的**出勤情况**和**考勤规范性**。系数B是升级的**底线前提条件**，不参与月度得分的加权计算。

### 3.2 底线要求

```
要求: 考核周期内每月系数B ≥ 1（以绩效核对口径为准）
不满足 → 不具备升级资格
```

### 3.3 数据来源

| 数据项 | 来源 | 说明 |
|-------|------|------|
| 实际出勤天数 | NFC考勤系统 | OFFICE_IN打卡记录 |
| 应出勤天数 | 人事系统 | 扣除节假日、请假后 |

### 3.4 异常类型定义

| 异常类型 | 定义 | 影响 |
|---------|------|------|
| 迟到 | 首次打卡时间 > 9:30 | 系数B扣减 |
| 早退 | 最后打卡时间 < 18:00 | 系数B扣减 |
| 缺卡 | 当日无打卡记录 | 系数B扣减 |
| 位置异常 | GPS偏差 > 100米 | 标记审核 |

---

## 4. 系数C：重点业务目标达成（排名权重70）

### 4.1 定义

反映租务管家在**房源维护**和**业务转化**方面的表现。

### 4.2 计算公式

```
系数C = 巡检完成率 × 0.4 + 签约达成率 × 0.6

其中:
- 巡检完成率 = 实际巡检次数 / 计划巡检次数
- 签约达成率 = 实际签约数 / 目标签约数
```

### 4.3 巡检指标

| 指标 | 说明 | 计算方式 |
|-----|------|---------|
| 计划巡检次数 | 系统分配任务 | 每房源每周1次 |
| 实际巡检次数 | NFC巡检打卡 | INSPECT类型记录 |
| 巡检覆盖率 | 覆盖房源比例 | 已巡检房源 / 总负责房源 |

### 4.4 签约指标

| 指标 | 说明 | 计算方式 |
|-----|------|---------|
| 目标签约数 | 月度业务目标 | 根据房源量分配 |
| 实际签约数 | 系统签约记录 | 合同签约数据 |
| 现场签约率 | NFC签约打卡占比 | 现场签约数 / 总签约数 |

---

## 5. 升级规则

### 5.1 前提条件（需全部满足）

| 序号 | 条件 | 说明 |
|------|------|------|
| 1 | 底线考核标准达标 | 考核周期内每月系数B ≥ 1 |
| 2 | 季度内不在低绩效名单 | 未触发绩效提升管理制度 |
| 3 | 季度内个人有责客诉 ≤ 1 | 对接客服系统判定 |
| 4 | 不在限制晋升期 | 未因低绩效被限制晋升（限制期3个月） |

### 5.2 升级条件

> 季度考核周期内得分排名**前20%（含）** → 升一级

---

## 6. 降级规则

> **降级不单独设立**，详见租务管家AM绩效提升管理制度。
>
> 即：排名靠后不会直接触发降级，降级来源于绩效提升管理制度中的低绩效管理流程。

---

## 7. 抵冲规则

| 序号 | 场景 | 处理方式 |
|------|------|---------|
| 1 | 升级但无级可升 | 升级结果保留，可抵扣一次后续降级（如次月进入低绩效降级，职级不变） |
| 2 | 低绩效降级但无级可降 | 降级结果保留，可抵扣一次后续升级（如下季度晋降级为升级，职级不变） |
| 3 | 当月既升级又进入低绩效降级 | 互相抵冲，当月不升不降，职级不变 |

---

## 8. 特殊口径

### 8.1 新入职/调转/降职

| 当季在岗时长 | 处理方式 |
|-------------|---------|
| ≥ 2个月 | 参与排名，**只升不降**（数据取2个完整月） |
| < 2个月 | 不参与排名及考核 |

### 8.2 长病假/产假

- 考核周期内请假 > 30天 → 当季度**免考**
- 请资租务经理于每月4号前向人力团队提报

---

## 9. 绩效提升管理制度（摘要）

> 来源：惠居上海资管经理AM绩效提升管理制度3.0

### 9.1 低绩效认定

进入绩效待提升公示名单的条件由绩效提升管理制度另行规定（如：月度核心业务指标未达标）。

### 9.2 渐进式管理流程

```
第1次进入名单 → 直接降级 + 总监绩效辅导（月度，AI评分）
        ↓
第2次连续进入 → 再次降级 + 大部总绩效辅导（腾讯会议记录）
        ↓
第3次连续进入 → 视为不胜任岗位（无法内部调转）
```

### 9.3 附带限制

| 限制类型 | 内容 |
|---------|------|
| 晋升限制 | 进入名单当季度无法升级，3个月内无法晋升 |
| 调转限制 | 进入名单当月限制团队内调转 |
| M级特殊处理 | 战队长M进入名单自动降为A，3个月内不能再任命为M |
| 储备出池 | 储备总监进入名单当月出池，3个月内无法再参与选拔 |
| 总监连带 | 连续三次进入名单的每位管家，对应总监月度升降级得分-5分 |

---

## 10. 指标关联设计

### 10.1 数据流

```
NFC打卡 → 实时验证 → 质量评分 → 指标更新 → 排名计算 → 晋降级评估
   ↓           ↓           ↓           ↓           ↓           ↓
 记录      距离/GPS     0-150分     系数A/B/C   百分位排名   升级/维持
```

### 10.2 指标关联关系

| 上游指标 | → | 下游指标 |
|---------|---|---------|
| NFC带看打卡 | → | 系数A计算 |
| NFC考勤打卡 | → | 系数B计算（底线） |
| NFC巡检打卡 | → | 系数C-巡检完成率 |
| NFC签约打卡 | → | 系数C-签约达成率 |
| 系数A/C | → | 月度得分 |
| 月度得分 | → | 季度均值 → AM通排 |
| AM通排排名 | → | 前20%升级 |
| 绩效提升管理制度 | → | 降级判定（独立通道） |

---

## 11. 实时数据看板指标

### 11.1 个人看板（租务管家H5）

| 指标类型 | 指标名称 | 更新频率 | 数据来源 |
|---------|---------|---------|---------|
| 今日数据 | 今日打卡次数 | 实时 | attendance_records |
| | 今日带看次数 | 实时 | attendance_records |
| | 今日巡检房源数 | 实时 | attendance_records |
| 本周数据 | 本周带看累计 | 每日 | user_daily_stats |
| | 本周验证通过率 | 每日 | user_daily_stats |
| | 本周平均质量分 | 每日 | user_daily_stats |
| 本月数据 | 本月系数A | 每日 | performance_metrics |
| | 本月系数B（达标/未达标） | 每日 | performance_metrics |
| | 本月系数C | 每日 | performance_metrics |
| | 当前AM通排排名 | 每日 | performance_metrics |
| 排名信息 | 部门内排名（参考） | 每日 | performance_metrics |
| | AM通排排名（正式） | 每日 | performance_metrics |
| 预警信息 | 异常打卡提醒 | 实时 | anomaly_rules |
| | 目标达成进度 | 每日 | 计算指标 |

### 11.2 管理看板（运营端PC）

| 维度 | 指标名称 | 作用 |
|-----|---------|------|
| 团队概览 | 团队人数 | 编制管理 |
| | 今日出勤人数 | 考勤监控 |
| | 今日异常人数 | 风险预警 |
| | 平均质量评分 | 质量监控 |
| 业务指标 | 团队带看总数 | 业务追踪 |
| | 团队验证通过率 | 数据质量 |
| | 团队签约转化 | 业绩监控 |
| | 团队巡检覆盖率 | 房源管理 |
| 排名分布 | 晋级候选人（前20%） | 人才盘点 |
| | 绩效提升管理预警人员 | 风险预警 |
| | 各职级分布 | 结构分析 |
| 趋势分析 | 7日打卡趋势 | 趋势监控 |
| | 月度指标趋势 | 周期分析 |
| | 同比/环比数据 | 对比分析 |

---

## 12. NFC打卡数据质量评分模型

### 12.1 评分维度（总分150分）

| 维度 | 分值 | 评分规则 |
|-----|------|---------|
| **GPS距离** | 50分 | <50米=50分，50-100米=30分，>100米=0分 |
| **停留时长** | 40分 | >30分钟=40分，10-30分钟按比例，<10分钟=0分 |
| **照片完整性** | 30分 | 入户照片+室内照片各15分 |
| **时间合理性** | 20分 | 正常工作时间+5分，非工作时间-10分 |
| **设备一致性** | 10分 | 使用绑定设备+10分，非绑定设备0分 |

### 12.2 质量等级划分

| 总分 | 等级 | 处理方式 |
|-----|------|---------|
| 130-150 | 优秀 | 数据可信，正常计入绩效 |
| 100-129 | 良好 | 数据可信，正常计入绩效 |
| 70-99 | 一般 | 需人工复核后计入 |
| <70 | 较差 | 标记为可疑，不计入绩效 |

### 12.3 异常标记规则

| 异常类型 | 触发条件 | 系统动作 |
|---------|---------|---------|
| GPS偏差 | GPS距离>500米 | 阻断+人工复核 |
| 短时打卡 | 停留<5分钟 | 标记异常+预警 |
| 重复打卡 | 同一房源30分钟内重复 | 阻断+提示 |
| 深夜打卡 | 0:00-5:00打卡 | 标记异常+需说明 |
| 设备异常 | 非绑定设备 | 要求验证+记录 |

---

## 13. 系统计算逻辑

### 13.1 计算频率

| 指标 | 计算频率 | 说明 |
|-----|---------|------|
| 单次打卡质量分 | 实时 | 打卡完成后立即计算 |
| 每日统计 | 每日凌晨00:30 | 汇总当日数据 |
| 系数A/B/C | 实时+每日校准 | 实时更新+每日校准 |
| AM通排排名 | 每4小时 | 全量重新排名 |
| 月度绩效汇总 | 每月1日03:00 | 月度评估报告 |
| 季度晋降级评估 | 季度末 | 季度均值+排名+晋降级判定 |

### 13.2 每日统计流程

```
每日00:30执行:
  1. 汇总昨日打卡数据
  2. 计算个人每日统计(user_daily_stats)
  3. 计算质量评分
  4. 标记异常记录
  5. 更新月度累计数据
  6. 发送日报通知
```

### 13.3 月度绩效计算流程

```
每月1日03:00执行:
  1. 汇总上月完整数据
  2. 计算系数A/B/C
  3. 计算月度得分 = 系数A排名×30 + 系数C排名×70 (AM通排)
  4. 检查系数B底线是否达标
  5. 更新绩效指标表(performance_metrics)
  6. 发送月报通知
```

### 13.4 季度晋降级计算流程

```
季度末执行:
  1. 计算季度得分 = 季度内月度得分均值
  2. AM全量通排
  3. 判定前20%升级候选人
  4. 校验升级前提条件（B≥1、无低绩效、客诉≤1、无晋升限制）
  5. 处理抵冲逻辑
  6. 处理特殊口径（新入职只升不降、免考等）
  7. 生成晋降级结果
  8. 发送季度报告
```

### 13.5 绩效计算代码

```typescript
class PerformanceCalculator {
  
  // 计算系数A
  async calculateCoefficientA(userId: string, period: string): Promise<number> {
    const stats = await this.getShowingStats(userId, period);
    const verificationRate = stats.verifiedCount / stats.totalCount;
    const target = await this.getTargetByLevel(userId); // 按职级取目标值
    const targetCompletion = Math.min(stats.verifiedCount / target, 1);
    
    // 验证通过率 < 70% 打5折
    const rateMultiplier = verificationRate >= 0.7 ? 1.0 : 0.5;
    return verificationRate * targetCompletion * rateMultiplier;
  }
  
  // 检查系数B底线
  async checkCoefficientB(userId: string, period: string): Promise<{
    value: number;
    qualified: boolean;
  }> {
    const attendance = await this.getAttendanceStats(userId, period);
    const value = attendance.actualDays / attendance.requiredDays;
    return { value, qualified: value >= 1.0 };
  }
  
  // 计算系数C
  async calculateCoefficientC(userId: string, period: string): Promise<number> {
    const inspection = await this.getInspectionStats(userId, period);
    const signing = await this.getSigningStats(userId, period);
    
    const inspectionRate = inspection.completed / inspection.planned;
    const signingRate = signing.actual / signing.target;
    
    return inspectionRate * 0.4 + signingRate * 0.6;
  }
  
  // 计算月度得分
  async calculateMonthlyScore(userId: string, month: string): Promise<number> {
    const coeffA = await this.calculateCoefficientA(userId, month);
    const coeffC = await this.calculateCoefficientC(userId, month);
    
    // 获取AM通排百分位排名
    const rankA = await this.getPercentileRank('coefficient_a', coeffA, month);
    const rankC = await this.getPercentileRank('coefficient_c', coeffC, month);
    
    // 月度得分 = A排名×30 + C排名×70
    return rankA * 30 + rankC * 70;
  }
  
  // 季度晋降级评估
  async evaluateQuarter(userId: string, quarter: string): Promise<{
    quarterScore: number;
    percentileRank: number;
    evaluation: 'UPGRADE' | 'MAINTAIN';
  }> {
    const months = this.getMonthsInQuarter(quarter);
    const monthlyScores = await Promise.all(
      months.map(m => this.calculateMonthlyScore(userId, m))
    );
    
    // 季度得分 = 月度均值
    const quarterScore = monthlyScores.reduce((a, b) => a + b, 0) / monthlyScores.length;
    
    // AM通排百分位
    const percentileRank = await this.getPercentileRank('quarter_score', quarterScore, quarter);
    
    // 升级判定（降级由绩效提升管理制度独立触发，此处不判定）
    let evaluation: 'UPGRADE' | 'MAINTAIN' = 'MAINTAIN';
    
    if (percentileRank >= 80) { // 前20%
      // 校验升级前提条件
      const prerequisites = await this.checkUpgradePrerequisites(userId, quarter);
      if (prerequisites.allMet) {
        evaluation = 'UPGRADE';
      }
    }
    
    return { quarterScore, percentileRank, evaluation };
  }
  
  // 校验升级前提条件
  async checkUpgradePrerequisites(userId: string, quarter: string): Promise<{
    allMet: boolean;
    details: {
      coefficientBQualified: boolean;    // 每月系数B≥1
      notInLowPerformance: boolean;      // 不在低绩效名单
      complaintsQualified: boolean;       // 有责客诉≤1
      notInPromotionRestriction: boolean; // 不在限制晋升期
    };
  }> {
    const months = this.getMonthsInQuarter(quarter);
    
    // 检查每月系数B
    const bChecks = await Promise.all(
      months.map(m => this.checkCoefficientB(userId, m))
    );
    const coefficientBQualified = bChecks.every(b => b.qualified);
    
    // 检查低绩效名单
    const notInLowPerformance = !(await this.isInLowPerformanceList(userId, quarter));
    
    // 检查客诉
    const complaints = await this.getComplaintCount(userId, quarter);
    const complaintsQualified = complaints <= 1;
    
    // 检查晋升限制期
    const notInPromotionRestriction = !(await this.isInPromotionRestriction(userId));
    
    return {
      allMet: coefficientBQualified && notInLowPerformance && complaintsQualified && notInPromotionRestriction,
      details: { coefficientBQualified, notInLowPerformance, complaintsQualified, notInPromotionRestriction }
    };
  }
}
```

---

## 14. 数据接口需求

### 14.1 需对接系统

| 系统 | 数据方向 | 数据内容 |
|-----|---------|---------|
| 人事系统 | 读取 | 员工信息、职级、入职时间、在岗时长 |
| 房源系统 | 读取 | 房源信息、负责关系 |
| 签约系统 | 读取 | 签约数据、客户信息 |
| 客服系统 | 读取 | 客诉记录、有责判定 |
| 绩效提升管理系统 | 读取 | 低绩效名单、限制晋升期 |
| 飞书 | 双向 | 通知、审批、报表 |

### 14.2 API清单

- `GET /api/v1/performance/current` - 获取当前绩效数据
- `GET /api/v1/performance/ranking` - 获取AM通排排名数据
- `GET /api/v1/performance/history` - 获取历史趋势
- `POST /api/v1/performance/calculate` - 触发重新计算
- `GET /api/v1/performance/upgrade-check` - 升级前提条件校验
- `GET /api/v1/performance/offset-credits` - 抵冲额度查询

---

## 15. 指标对齐检查清单

| Q4规则条款 | 系统实现 | 状态 |
|-----------|---------|------|
| 月度得分 = A排名×30 + C排名×70 | 绩效计算服务 | ✅ |
| 季度得分 = 月度均值 | 季度汇总逻辑 | ✅ |
| AM通排（不按职级分组） | 排名计算服务 | ✅ |
| 系数B为底线（≥1），不参与计分 | 前提条件校验 | ✅ |
| 升级前提：B≥1 + 无低绩效 + 客诉≤1 + 无晋升限制 | 升级条件校验 | ✅ |
| 前20%升级 | 排名判定 | ✅ |
| 降级不单独设立（走绩效提升管理制度） | 独立降级通道 | ✅ |
| 抵冲规则（3条） | 抵冲逻辑 | ✅ |
| 新入职/调转特殊口径 | 免考/只升不降逻辑 | ✅ |
| 长病假/产假免考 | 免考标记 | ✅ |
| 有责客诉对接 | 客服系统对接 | 🔄 待对接 |
| 绩效提升管理制度集成 | 低绩效名单对接 | 🔄 待对接 |
