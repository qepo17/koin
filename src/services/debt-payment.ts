import { eq, and, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../db/schema";
import { debtAccounts, debts, debtPayments, debtPaymentAllocations } from "../db/schema";
import { Decimal } from "decimal.js";

export type DebtPaymentService = ReturnType<typeof createDebtPaymentService>;

type DbTransaction = Parameters<Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]>[0];

export async function incrementDebtPaymentAllocationAmount(
  tx: DbTransaction,
  allocationId: string,
  amount: Decimal.Value
) {
  const increment = new Decimal(amount);

  if (increment.lte(0)) return;

  await tx
    .update(debtPaymentAllocations)
    .set({
      amount: sql`${debtPaymentAllocations.amount} + ${increment.toFixed(2)}`,
    })
    .where(eq(debtPaymentAllocations.id, allocationId));
}

export function createDebtPaymentService(db: PostgresJsDatabase<typeof schema>) {
  /**
   * Auto-detect and create a debt payment when a transaction matches a debt account's category.
   * Returns the created payment or null if no match / multiple matches.
   */
  async function autoCreatePayment(
    userId: string,
    transactionId: string,
    categoryId: string,
    amount: string,
    date: Date
  ) {
    return await db.transaction(async (tx) => {
      // Find debt accounts matching this category
      const matchingAccounts = await tx
        .select()
        .from(debtAccounts)
        .where(
          and(
            eq(debtAccounts.userId, userId),
            eq(debtAccounts.categoryId, categoryId),
            eq(debtAccounts.autoTrack, true),
            eq(debtAccounts.status, "active")
          )
        );

      // Skip if zero or multiple matches
      if (matchingAccounts.length !== 1) return null;

      const account = matchingAccounts[0];

      // Create payment record
      const [payment] = await tx
        .insert(debtPayments)
        .values({
          accountId: account.id,
          userId,
          totalAmount: amount,
          transactionId,
          paidAt: date,
        })
        .returning();

      // Get active debts for this account, allocate by monthly_amount
      const activeDebts = await tx
        .select()
        .from(debts)
        .where(and(eq(debts.accountId, account.id), eq(debts.status, "active")))
        .orderBy(debts.createdAt);

      if (activeDebts.length > 0) {
        let remaining = new Decimal(amount);

        for (const debt of activeDebts) {
          if (remaining.lte(0)) break;
          const monthlyAmount = new Decimal(debt.monthlyAmount);
          const allocAmount = remaining.lt(monthlyAmount) ? remaining : monthlyAmount;
          remaining = remaining.minus(allocAmount);

          await tx.insert(debtPaymentAllocations).values({
            paymentId: payment.id,
            debtId: debt.id,
            amount: allocAmount.toFixed(2),
          });
        }

        // Excess goes to first debt
        if (remaining.gt(0)) {
          const firstAllocation = await tx
            .select()
            .from(debtPaymentAllocations)
            .where(
              and(
                eq(debtPaymentAllocations.paymentId, payment.id),
                eq(debtPaymentAllocations.debtId, activeDebts[0].id)
              )
            );

          if (firstAllocation.length > 0) {
            await incrementDebtPaymentAllocationAmount(tx, firstAllocation[0].id, remaining);
          }
        }
      }

      return payment;
    });
  }

  /**
   * Remove debt payment linked to a transaction (on transaction deletion).
   */
  async function removePaymentByTransaction(transactionId: string) {
    // Cascade delete handles allocations via FK
    const deleted = await db
      .delete(debtPayments)
      .where(eq(debtPayments.transactionId, transactionId))
      .returning();

    return deleted.length > 0 ? deleted[0] : null;
  }

  return { autoCreatePayment, removePaymentByTransaction };
}
