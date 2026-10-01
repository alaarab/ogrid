import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { toNumber, flattenArgs, evalArg } from '../evaluator';

export function registerFinancialFunctions(registry: Map<string, IFormulaFunction>): void {
  // PMT(rate, nper, pv, [fv=0], [type=0])
  // Periodic payment for a loan/annuity.
  registry.set('PMT', {
    minArgs: 3,
    maxArgs: 5,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawRate = evalArg(evaluator, args[0], context);
      if (rawRate instanceof FormulaError) return rawRate;
      const rate = toNumber(rawRate);
      if (rate instanceof FormulaError) return rate;

      const rawNper = evalArg(evaluator, args[1], context);
      if (rawNper instanceof FormulaError) return rawNper;
      const nper = toNumber(rawNper);
      if (nper instanceof FormulaError) return nper;

      const rawPv = evalArg(evaluator, args[2], context);
      if (rawPv instanceof FormulaError) return rawPv;
      const pv = toNumber(rawPv);
      if (pv instanceof FormulaError) return pv;

      let fv = 0;
      if (args.length >= 4) {
        const rawFv = evalArg(evaluator, args[3], context);
        if (rawFv instanceof FormulaError) return rawFv;
        const fvNum = toNumber(rawFv);
        if (fvNum instanceof FormulaError) return fvNum;
        fv = fvNum;
      }

      let type = 0;
      if (args.length >= 5) {
        const rawType = evalArg(evaluator, args[4], context);
        if (rawType instanceof FormulaError) return rawType;
        const typeNum = toNumber(rawType);
        if (typeNum instanceof FormulaError) return typeNum;
        type = typeNum;
      }

      if (nper === 0) return new FormulaError('#NUM!', 'PMT: nper cannot be 0');

      if (rate === 0) {
        return -(pv + fv) / nper;
      }

      const factor = (1 + rate) ** nper;
      const typeAdj = type !== 0 ? (1 + rate) : 1;
      return -(pv * factor + fv) / ((factor - 1) / rate * typeAdj);
    },
  });

  // FV(rate, nper, pmt, [pv=0], [type=0])
  // Future value of an investment.
  registry.set('FV', {
    minArgs: 3,
    maxArgs: 5,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawRate = evalArg(evaluator, args[0], context);
      if (rawRate instanceof FormulaError) return rawRate;
      const rate = toNumber(rawRate);
      if (rate instanceof FormulaError) return rate;

      const rawNper = evalArg(evaluator, args[1], context);
      if (rawNper instanceof FormulaError) return rawNper;
      const nper = toNumber(rawNper);
      if (nper instanceof FormulaError) return nper;

      const rawPmt = evalArg(evaluator, args[2], context);
      if (rawPmt instanceof FormulaError) return rawPmt;
      const pmt = toNumber(rawPmt);
      if (pmt instanceof FormulaError) return pmt;

      let pv = 0;
      if (args.length >= 4) {
        const rawPv = evalArg(evaluator, args[3], context);
        if (rawPv instanceof FormulaError) return rawPv;
        const pvNum = toNumber(rawPv);
        if (pvNum instanceof FormulaError) return pvNum;
        pv = pvNum;
      }

      let type = 0;
      if (args.length >= 5) {
        const rawType = evalArg(evaluator, args[4], context);
        if (rawType instanceof FormulaError) return rawType;
        const typeNum = toNumber(rawType);
        if (typeNum instanceof FormulaError) return typeNum;
        type = typeNum;
      }

      if (rate === 0) {
        return -(pv + pmt * nper);
      }

      const factor = (1 + rate) ** nper;
      const typeAdj = type !== 0 ? (1 + rate) : 1;
      return -(pv * factor + pmt * typeAdj * (factor - 1) / rate);
    },
  });

  // PV(rate, nper, pmt, [fv=0], [type=0])
  // Present value of an annuity.
  registry.set('PV', {
    minArgs: 3,
    maxArgs: 5,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawRate = evalArg(evaluator, args[0], context);
      if (rawRate instanceof FormulaError) return rawRate;
      const rate = toNumber(rawRate);
      if (rate instanceof FormulaError) return rate;

      const rawNper = evalArg(evaluator, args[1], context);
      if (rawNper instanceof FormulaError) return rawNper;
      const nper = toNumber(rawNper);
      if (nper instanceof FormulaError) return nper;

      const rawPmt = evalArg(evaluator, args[2], context);
      if (rawPmt instanceof FormulaError) return rawPmt;
      const pmt = toNumber(rawPmt);
      if (pmt instanceof FormulaError) return pmt;

      let fv = 0;
      if (args.length >= 4) {
        const rawFv = evalArg(evaluator, args[3], context);
        if (rawFv instanceof FormulaError) return rawFv;
        const fvNum = toNumber(rawFv);
        if (fvNum instanceof FormulaError) return fvNum;
        fv = fvNum;
      }

      let type = 0;
      if (args.length >= 5) {
        const rawType = evalArg(evaluator, args[4], context);
        if (rawType instanceof FormulaError) return rawType;
        const typeNum = toNumber(rawType);
        if (typeNum instanceof FormulaError) return typeNum;
        type = typeNum;
      }

      if (rate === 0) {
        return -pmt * nper - fv;
      }

      const factor = (1 + rate) ** nper;
      const typeAdj = type !== 0 ? (1 + rate) : 1;
      return -(fv + pmt * typeAdj * (factor - 1) / rate) / factor;
    },
  });

  // NPER(rate, pmt, pv, [fv=0], [type=0])
  // Number of periods for an annuity.
  registry.set('NPER', {
    minArgs: 3,
    maxArgs: 5,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawRate = evalArg(evaluator, args[0], context);
      if (rawRate instanceof FormulaError) return rawRate;
      const rate = toNumber(rawRate);
      if (rate instanceof FormulaError) return rate;

      const rawPmt = evalArg(evaluator, args[1], context);
      if (rawPmt instanceof FormulaError) return rawPmt;
      const pmt = toNumber(rawPmt);
      if (pmt instanceof FormulaError) return pmt;

      const rawPv = evalArg(evaluator, args[2], context);
      if (rawPv instanceof FormulaError) return rawPv;
      const pv = toNumber(rawPv);
      if (pv instanceof FormulaError) return pv;

      let fv = 0;
      if (args.length >= 4) {
        const rawFv = evalArg(evaluator, args[3], context);
        if (rawFv instanceof FormulaError) return rawFv;
        const fvNum = toNumber(rawFv);
        if (fvNum instanceof FormulaError) return fvNum;
        fv = fvNum;
      }

      let type = 0;
      if (args.length >= 5) {
        const rawType = evalArg(evaluator, args[4], context);
        if (rawType instanceof FormulaError) return rawType;
        const typeNum = toNumber(rawType);
        if (typeNum instanceof FormulaError) return typeNum;
        type = typeNum;
      }

      if (rate === 0) {
        if (pmt === 0) return new FormulaError('#NUM!', 'NPER: pmt cannot be 0 when rate is 0');
        return -(pv + fv) / pmt;
      }

      const typeAdj = type !== 0 ? (1 + rate) : 1;
      const pmtAdj = pmt * typeAdj;

      // NPER = log((pmt - fv*rate) / (pmt + pv*rate)) / log(1+rate)
      // More precisely: log((pmtAdj - fv*rate) / (pmtAdj + pv*rate)) / log(1+rate)
      const num = pmtAdj - fv * rate;
      const den = pmtAdj + pv * rate;

      if (den === 0) return new FormulaError('#DIV/0!', 'NPER: division by zero');
      if (num / den <= 0) return new FormulaError('#NUM!', 'NPER: logarithm of non-positive number');

      return Math.log(num / den) / Math.log(1 + rate);
    },
  });

  // RATE(nper, pmt, pv, [fv=0], [type=0], [guess=0.1])
  // Interest rate per period using Newton-Raphson iteration.
  registry.set('RATE', {
    minArgs: 3,
    maxArgs: 6,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNper = evalArg(evaluator, args[0], context);
      if (rawNper instanceof FormulaError) return rawNper;
      const nper = toNumber(rawNper);
      if (nper instanceof FormulaError) return nper;

      const rawPmt = evalArg(evaluator, args[1], context);
      if (rawPmt instanceof FormulaError) return rawPmt;
      const pmt = toNumber(rawPmt);
      if (pmt instanceof FormulaError) return pmt;

      const rawPv = evalArg(evaluator, args[2], context);
      if (rawPv instanceof FormulaError) return rawPv;
      const pv = toNumber(rawPv);
      if (pv instanceof FormulaError) return pv;

      let fv = 0;
      if (args.length >= 4) {
        const rawFv = evalArg(evaluator, args[3], context);
        if (rawFv instanceof FormulaError) return rawFv;
        const fvNum = toNumber(rawFv);
        if (fvNum instanceof FormulaError) return fvNum;
        fv = fvNum;
      }

      let type = 0;
      if (args.length >= 5) {
        const rawType = evalArg(evaluator, args[4], context);
        if (rawType instanceof FormulaError) return rawType;
        const typeNum = toNumber(rawType);
        if (typeNum instanceof FormulaError) return typeNum;
        type = typeNum;
      }

      let guess = 0.1;
      if (args.length >= 6) {
        const rawGuess = evalArg(evaluator, args[5], context);
        if (rawGuess instanceof FormulaError) return rawGuess;
        const guessNum = toNumber(rawGuess);
        if (guessNum instanceof FormulaError) return guessNum;
        guess = guessNum;
      }

      if (nper <= 0 || !Number.isFinite(nper) || guess <= -1 || (type !== 0 && type !== 1)) return new FormulaError('#NUM!', 'Invalid RATE arguments');
      // Normalise by the discount factor so long loans don't overflow (1+r)^n.
      const equation = (rate: number): number => {
        if (Math.abs(rate) < 1e-10) return pv + pmt * nper + fv;
        const exponent = -nper * Math.log1p(rate);
        const discount = Math.exp(exponent);
        return pv + pmt * (1 + rate * type) * (-Math.expm1(exponent)) / rate + (fv === 0 ? 0 : fv * discount);
      };
      const tolerance = Math.max(1, Math.abs(pv), Math.abs(pmt), Math.abs(fv)) * 1e-10;
      if (Math.abs(equation(0)) <= tolerance) return 0;
      // First try the caller's guess, with a hard cap and a safeguarded step.
      let rate = guess;
      for (let i = 0; i < 30; i++) {
        const value = equation(rate);
        if (Number.isFinite(value) && Math.abs(value) <= tolerance) return rate;
        const h = Math.max(1e-7, Math.abs(rate) * 1e-5);
        const derivative = (equation(rate + h) - equation(rate - h)) / (2 * h);
        const next = rate - value / derivative;
        if (!Number.isFinite(next) || next <= -0.999999 || Math.abs(next - rate) > 1) break;
        rate = next;
      }
      // Search a finite bracket, then bisect for at most 100 iterations.
      let low = -0.999;
      let high = Math.max(1, guess);
      let lowValue = equation(low);
      let highValue = equation(high);
      for (let i = 0; i < 32 && Math.sign(lowValue) === Math.sign(highValue); i++) {
        high *= 2;
        highValue = equation(high);
      }
      if (Number.isNaN(lowValue) || Number.isNaN(highValue) || Math.sign(lowValue) === Math.sign(highValue)) return new FormulaError('#NUM!', 'RATE: no root found');
      for (let i = 0; i < 100; i++) {
        const mid = (low + high) / 2;
        const value = equation(mid);
        if (Number.isFinite(value) && Math.abs(value) <= tolerance) return mid;
        if (Number.isNaN(value)) break;
        if (Math.sign(value) === Math.sign(lowValue)) { low = mid; lowValue = value; }
        else high = mid;
      }
      return new FormulaError('#NUM!', 'RATE: did not converge');
    },
  });

  // NPV(rate, value1, [value2], ...)
  // Net present value of cash flows.
  registry.set('NPV', {
    minArgs: 2,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawRate = evalArg(evaluator, args[0], context);
      if (rawRate instanceof FormulaError) return rawRate;
      const rate = toNumber(rawRate);
      if (rate instanceof FormulaError) return rate;

      const values = flattenArgs(args.slice(1), context, evaluator);
      let npv = 0;
      let period = 1;
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (typeof val === 'number' || typeof val === 'boolean') {
          const n = typeof val === 'boolean' ? (val ? 1 : 0) : val;
          npv += n / (1 + rate) ** period;
          period++;
        }
        // Strings and nulls are ignored in NPV (Excel behavior)
      }
      return npv;
    },
  });

  // IRR(values, [guess=0.1])
  // Internal rate of return using Newton-Raphson on NPV=0.
  registry.set('IRR', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const valuesArg = args[0];
      if (valuesArg === undefined) return new FormulaError('#NUM!', 'IRR: no values');
      const cashFlows = flattenArgs([valuesArg], context, evaluator);
      const nums: number[] = [];
      for (const val of cashFlows) {
        if (val instanceof FormulaError) return val;
        if (typeof val === 'number') nums.push(val);
        else if (typeof val === 'boolean') nums.push(val ? 1 : 0);
      }

      if (nums.length === 0) return new FormulaError('#NUM!', 'IRR: no values');

      let guess = 0.1;
      if (args.length >= 2) {
        const rawGuess = evalArg(evaluator, args[1], context);
        if (rawGuess instanceof FormulaError) return rawGuess;
        const guessNum = toNumber(rawGuess);
        if (guessNum instanceof FormulaError) return guessNum;
        guess = guessNum;
      }

      const MAX_ITER = 20;
      const TOLERANCE = 1e-7;
      let r = guess;

      for (let i = 0; i < MAX_ITER; i++) {
        if (r <= -1) return new FormulaError('#NUM!', 'IRR: rate converged below -1');

        // f(r) = sum(cashFlows[i] / (1+r)^i) for i=0..n-1
        let f = 0;
        let df = 0;
        for (let j = 0; j < nums.length; j++) {
          context.consumeWork?.(1);
          const flow = nums[j];
          if (flow === undefined) continue;
          const factor = (1 + r) ** j;
          f += flow / factor;
          if (j > 0) {
            df -= j * flow / (1 + r) ** (j + 1);
          }
        }

        if (Math.abs(df) < 1e-15) return new FormulaError('#NUM!', 'IRR: derivative too small');

        const delta = f / df;
        r = r - delta;

        if (Math.abs(delta) < TOLERANCE) return r;
      }

      return new FormulaError('#NUM!', 'IRR: did not converge');
    },
  });

  // SLN(cost, salvage, life)
  // Straight-line depreciation.
  registry.set('SLN', {
    minArgs: 3,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawCost = evalArg(evaluator, args[0], context);
      if (rawCost instanceof FormulaError) return rawCost;
      const cost = toNumber(rawCost);
      if (cost instanceof FormulaError) return cost;

      const rawSalvage = evalArg(evaluator, args[1], context);
      if (rawSalvage instanceof FormulaError) return rawSalvage;
      const salvage = toNumber(rawSalvage);
      if (salvage instanceof FormulaError) return salvage;

      const rawLife = evalArg(evaluator, args[2], context);
      if (rawLife instanceof FormulaError) return rawLife;
      const life = toNumber(rawLife);
      if (life instanceof FormulaError) return life;

      if (life === 0) return new FormulaError('#DIV/0!', 'SLN: life cannot be 0');

      return (cost - salvage) / life;
    },
  });
}
