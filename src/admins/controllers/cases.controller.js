const Case = require("../../models/Case");

function buildSort(sort) {
  switch (sort) {
    case "createdAt_asc":
      return { createdAt: 1 };
    case "updatedAt_desc":
      return { updatedAt: -1 };
    case "priority_desc":
      return { priority: -1, createdAt: -1 };
    case "createdAt_desc":
    default:
      return { createdAt: -1 };
  }
}

exports.listCases = async (req, res) => {
  try {
    const {
      search,
      status,
      type,
      assignee,
      priority,
      reportedBy,
      sort = "createdAt_desc",
      cursor,
      limit = 10,
    } = req.query;

    const pageSize = Math.min(Number(limit) || 10, 100);
    const pageIndex = Number(cursor || 0) || 0;

    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (assignee) filter.assignee = assignee;
    if (priority) filter.priority = priority;
    if (reportedBy) filter.reportedByRole = reportedBy;

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { referenceCode: regex },
        { bookingRef: regex },
        { userEmail: regex },
        { userName: regex },
        { hostEmail: regex },
      ];
    }

    const sortObj = buildSort(sort);

    const docs = await Case.find(filter)
      .sort(sortObj)
      .skip(pageIndex * pageSize)
      .limit(pageSize + 1)
      .lean();

    const hasMore = docs.length > pageSize;
    const items = hasMore ? docs.slice(0, pageSize) : docs;
    const nextCursor = hasMore ? String(pageIndex + 1) : null;

    res.json({ items, nextCursor });
  } catch (err) {
    console.error("listCases error", err);
    res.status(500).json({ message: "Failed to load cases" });
  }
};

exports.assignCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignee } = req.body;
    const now = new Date();

    const update = {
      assignee: assignee || null,
      updatedAt: now,
      $push: {
        timeline: {
          at: now,
          type: "assignee",
          to: assignee || "",
        },
      },
    };

    const kase = await Case.findByIdAndUpdate(id, update, { new: true });
    if (!kase) return res.status(404).json({ message: "Case not found" });
    res.json(kase);
  } catch (err) {
    console.error("assignCase error", err);
    res.status(500).json({ message: "Failed to assign case" });
  }
};

exports.updateCaseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const now = new Date();

    const update = {
      status,
      updatedAt: now,
      $push: {
        timeline: {
          at: now,
          type: "status",
          to: status,
        },
      },
    };

    const kase = await Case.findByIdAndUpdate(id, update, { new: true });
    if (!kase) return res.status(404).json({ message: "Case not found" });
    res.json(kase);
  } catch (err) {
    console.error("updateCaseStatus error", err);
    res.status(500).json({ message: "Failed to update case status" });
  }
};

exports.updateCaseNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const now = new Date();

    const update = {
      adminNotes: adminNotes || "",
      updatedAt: now,
    };

    const kase = await Case.findByIdAndUpdate(id, update, { new: true });
    if (!kase) return res.status(404).json({ message: "Case not found" });
    res.json(kase);
  } catch (err) {
    console.error("updateCaseNotes error", err);
    res.status(500).json({ message: "Failed to update admin notes" });
  }
};

exports.recordCaseRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const now = new Date();

    const refund = {
      amount: Number(amount || 0),
      reason: reason || "",
      at: now,
    };

    const update = {
      refund,
      status: "refunded",
      updatedAt: now,
      $push: {
        timeline: {
          at: now,
          type: "refund",
          amount: refund.amount,
          reason: refund.reason,
        },
      },
    };

    const kase = await Case.findByIdAndUpdate(id, update, { new: true });
    if (!kase) return res.status(404).json({ message: "Case not found" });
    res.json(kase);
  } catch (err) {
    console.error("recordCaseRefund error", err);
    res.status(500).json({ message: "Failed to record refund" });
  }
};

exports.addCaseEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const { url } = req.body;
    const now = new Date();

    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }

    const update = {
      updatedAt: now,
      $push: {
        evidence: {
          url,
          addedAt: now,
          addedBy: "admin",
        },
      },
    };

    const kase = await Case.findByIdAndUpdate(id, update, { new: true });
    if (!kase) return res.status(404).json({ message: "Case not found" });
    res.json(kase);
  } catch (err) {
    console.error("addCaseEvidence error", err);
    res.status(500).json({ message: "Failed to add evidence" });
  }
};
