using System;
using System.Collections.Generic;
using System.Linq;

namespace BaiTapNeo4j;

public class PersonNode
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string FullName { get => Name; set => Name = value; }
    public string Gender { get; set; } = "Nam";
    public int BirthYear { get; set; } = 2000;
    public string BirthPlace { get; set; } = "";
    public string Occupation { get; set; } = "";
    public string Note { get; set; } = "";
    public string CCCD { get; set; } = "";
    public string PhoneNumber { get; set; } = "";
    public Dictionary<string, string> ExtraProps { get; set; } = new();

    public string DisplayText => $"{Name} ({Gender}, {BirthYear})";
    public override string ToString() => DisplayText;
}

public class StepInfo
{
    public string RelType { get; set; } = ""; // PARENT_OF, ADOPTED_PARENT_OF, MARRIED_TO, DIVORCED_FROM
    public bool IsUp { get; set; } // true if moving from child to parent, false if parent to child
}

public class PathResult
{
    public PersonNode PersonA { get; set; } = new();
    public PersonNode PersonB { get; set; } = new();
    public List<PersonNode> Nodes { get; set; } = new();
    public List<StepInfo> Steps { get; set; } = new();
}

public static class Kinship
{
    public static bool IsFemale(string gender)
    {
        if (string.IsNullOrWhiteSpace(gender)) return false;
        var g = gender.Trim().ToLower();
        return g == "nữ" || g == "nu" || g == "female" || g == "f";
    }

    public static int CountUp(PathResult path) =>
        path.Steps.Count(s => (s.RelType == "PARENT_OF" || s.RelType == "ADOPTED_PARENT_OF") && s.IsUp);

    public static int CountDown(PathResult path) =>
        path.Steps.Count(s => (s.RelType == "PARENT_OF" || s.RelType == "ADOPTED_PARENT_OF") && !s.IsUp);

    public static string TranslatePathToTitle(PathResult path)
    {
        if (path.Nodes.Count < 2 || path.Steps.Count == 0)
            return "Không có quan hệ họ hàng";

        var personA = path.PersonA;
        var personB = path.PersonB;

        bool hasMarriage = path.Steps.Any(s => s.RelType == "MARRIED_TO" || s.RelType == "DIVORCED_FROM");
        bool isDivorced = path.Steps.Any(s => s.RelType == "DIVORCED_FROM");
        bool isAdopted = path.Steps.Any(s => s.RelType == "ADOPTED_PARENT_OF");

        int upCount = path.Steps.Count(s => (s.RelType == "PARENT_OF" || s.RelType == "ADOPTED_PARENT_OF") && s.IsUp);
        int downCount = path.Steps.Count(s => (s.RelType == "PARENT_OF" || s.RelType == "ADOPTED_PARENT_OF") && !s.IsUp);

        string title = "";

        // Case 0: Direct Marriage (0 UP, 0 DOWN, HAS MARRIAGE)
        if (upCount == 0 && downCount == 0 && hasMarriage)
        {
            if (isDivorced)
                title = IsFemale(personB.Gender) ? "Vợ cũ (Đã ly hôn)" : "Chồng cũ (Đã ly hôn)";
            else
                title = IsFemale(personB.Gender) ? "Vợ" : "Chồng";
        }
        // Case 1: 1 UP, 0 DOWN (Parent)
        else if (upCount == 1 && downCount == 0 && !hasMarriage)
        {
            string parentTitle = IsFemale(personB.Gender) ? "Mẹ" : "Bố";
            title = isAdopted ? $"{parentTitle} nuôi" : parentTitle;
        }
        // Case 2: 0 UP, 1 DOWN (Child)
        else if (upCount == 0 && downCount == 1 && !hasMarriage)
        {
            string childTitle = IsFemale(personB.Gender) ? "Con gái" : "Con trai";
            title = isAdopted ? $"{childTitle} nuôi" : childTitle;
        }
        // Case 3: 2 UP, 0 DOWN (Grandparent)
        else if (upCount == 2 && downCount == 0 && !hasMarriage)
        {
            var parentA = path.Nodes[1];
            bool isNoi = !IsFemale(parentA.Gender);
            if (IsFemale(personB.Gender))
                title = isNoi ? "Bà nội" : "Bà ngoại";
            else
                title = isNoi ? "Ông nội" : "Ông ngoại";
        }
        // Case 4: 0 UP, 2 DOWN (Grandchild)
        else if (upCount == 0 && downCount == 2 && !hasMarriage)
        {
            var childA = path.Nodes[1];
            bool isNoi = !IsFemale(childA.Gender);
            title = isNoi ? "Cháu nội" : "Cháu ngoại";
        }
        // Case 5: 1 UP, 1 DOWN (Sibling)
        else if (upCount == 1 && downCount == 1 && !hasMarriage)
        {
            if (!IsFemale(personB.Gender))
            {
                title = personB.BirthYear <= personA.BirthYear ? "Anh ruột" : "Em trai ruột";
            }
            else
            {
                title = personB.BirthYear <= personA.BirthYear ? "Chị ruột" : "Em gái ruột";
            }
        }
        // Case 6: 2 UP, 1 DOWN (Uncle / Aunt)
        else if (upCount == 2 && downCount == 1 && !hasMarriage)
        {
            var parentA = path.Nodes[1]; // A's parent
            if (!IsFemale(parentA.Gender)) // Bố của A -> Nhánh Nội
            {
                if (IsFemale(personB.Gender)) title = "Cô";
                else title = personB.BirthYear < parentA.BirthYear ? "Bác" : "Chú";
            }
            else // Mẹ của A -> Nhánh Ngoại
            {
                if (!IsFemale(personB.Gender)) title = "Cậu";
                else title = personB.BirthYear < parentA.BirthYear ? "Bác" : "Dì";
            }
        }
        // Case 7: 1 UP, 2 DOWN (Nibling - Cháu ruột)
        else if (upCount == 1 && downCount == 2 && !hasMarriage)
        {
            title = IsFemale(personB.Gender) ? "Cháu gái ruột" : "Cháu trai ruột";
        }
        // Case 8: 2 UP, 2 DOWN (Cousin)
        else if (upCount == 2 && downCount == 2 && !hasMarriage)
        {
            if (!IsFemale(personB.Gender))
                title = personB.BirthYear <= personA.BirthYear ? "Anh họ" : "Em họ";
            else
                title = personB.BirthYear <= personA.BirthYear ? "Chị họ" : "Em họ";
        }
        // Case 9: In-laws (Con dâu / Con rể) (1 DOWN + 1 MARRIED)
        else if (downCount == 1 && upCount == 0 && hasMarriage)
        {
            title = IsFemale(personB.Gender) ? "Con dâu" : "Con rể";
        }
        // Case 10: Parent-in-law (Bố chồng/mẹ chồng, Bố vợ/mẹ vợ) (1 MARRIED + 1 UP)
        else if (upCount == 1 && downCount == 0 && hasMarriage)
        {
            var spouse = path.Nodes[1];
            if (IsFemale(spouse.Gender)) // Vợ của A
                title = IsFemale(personB.Gender) ? "Mẹ vợ" : "Bố vợ";
            else
                title = IsFemale(personB.Gender) ? "Mẹ chồng" : "Bố chồng";
        }
        else
        {
            string marriageInfo = hasMarriage ? " (có qua hôn nhân)" : "";
            title = $"Họ hàng ({upCount} đời lên, {downCount} đời xuống{marriageInfo})";
        }

        return title;
    }

    public static string FormatPathDescription(PathResult path)
    {
        if (path.Nodes.Count < 2) return "Không có đường đi";

        var sb = new System.Text.StringBuilder();
        sb.Append(path.Nodes[0].Name);

        for (int i = 0; i < path.Steps.Count; i++)
        {
            var step = path.Steps[i];
            var nextNode = path.Nodes[i + 1];

            if (step.RelType == "MARRIED_TO")
            {
                sb.Append("  ==[kết hôn]==>  ");
            }
            else if (step.RelType == "DIVORCED_FROM")
            {
                sb.Append("  ==[ly hôn]==>  ");
            }
            else if (step.RelType == "ADOPTED_PARENT_OF")
            {
                sb.Append(step.IsUp ? "  --(là con nuôi của)-->  " : "  --(là cha/mẹ nuôi của)-->  ");
            }
            else if (step.IsUp)
            {
                sb.Append("  --(là con của)-->  ");
            }
            else
            {
                sb.Append("  --(là cha/mẹ của)-->  ");
            }
            sb.Append(nextNode.Name);
        }
        return sb.ToString();
    }

    public static void SelfTest()
    {
        Console.WriteLine("=== CHẠY KINSHIP SELF-TEST ===");

        // Test 1: Bố
        var pathBo = new PathResult
        {
            PersonA = new PersonNode { Name = "Con", Gender = "Nam", BirthYear = 2000 },
            PersonB = new PersonNode { Name = "Bố", Gender = "Nam", BirthYear = 1970 },
            Nodes = new List<PersonNode>
            {
                new PersonNode { Name = "Con", Gender = "Nam", BirthYear = 2000 },
                new PersonNode { Name = "Bố", Gender = "Nam", BirthYear = 1970 }
            },
            Steps = new List<StepInfo> { new StepInfo { RelType = "PARENT_OF", IsUp = true } }
        };
        AssertEquals("Bố", TranslatePathToTitle(pathBo), "Test 1: Bố");

        // Test 2: Ông nội
        var pathOngNoi = new PathResult
        {
            PersonA = new PersonNode { Name = "Cháu", Gender = "Nam", BirthYear = 2010 },
            PersonB = new PersonNode { Name = "Ông Nội", Gender = "Nam", BirthYear = 1950 },
            Nodes = new List<PersonNode>
            {
                new PersonNode { Name = "Cháu", Gender = "Nam", BirthYear = 2010 },
                new PersonNode { Name = "Bố", Gender = "Nam", BirthYear = 1980 },
                new PersonNode { Name = "Ông Nội", Gender = "Nam", BirthYear = 1950 }
            },
            Steps = new List<StepInfo>
            {
                new StepInfo { RelType = "PARENT_OF", IsUp = true },
                new StepInfo { RelType = "PARENT_OF", IsUp = true }
            }
        };
        AssertEquals("Ông nội", TranslatePathToTitle(pathOngNoi), "Test 2: Ông nội");

        // Test 3: Bà ngoại
        var pathBaNgoai = new PathResult
        {
            PersonA = new PersonNode { Name = "Cháu", Gender = "Nam", BirthYear = 2010 },
            PersonB = new PersonNode { Name = "Bà Ngoại", Gender = "Nữ", BirthYear = 1952 },
            Nodes = new List<PersonNode>
            {
                new PersonNode { Name = "Cháu", Gender = "Nam", BirthYear = 2010 },
                new PersonNode { Name = "Mẹ", Gender = "Nữ", BirthYear = 1982 },
                new PersonNode { Name = "Bà Ngoại", Gender = "Nữ", BirthYear = 1952 }
            },
            Steps = new List<StepInfo>
            {
                new StepInfo { RelType = "PARENT_OF", IsUp = true },
                new StepInfo { RelType = "PARENT_OF", IsUp = true }
            }
        };
        AssertEquals("Bà ngoại", TranslatePathToTitle(pathBaNgoai), "Test 3: Bà ngoại");

        // Test 4: Chú
        var pathChu = new PathResult
        {
            PersonA = new PersonNode { Name = "Cháu", Gender = "Nam", BirthYear = 2010 },
            PersonB = new PersonNode { Name = "Chú Hùng", Gender = "Nam", BirthYear = 1985 },
            Nodes = new List<PersonNode>
            {
                new PersonNode { Name = "Cháu", Gender = "Nam", BirthYear = 2010 },
                new PersonNode { Name = "Bố", Gender = "Nam", BirthYear = 1980 },
                new PersonNode { Name = "Ông Nội", Gender = "Nam", BirthYear = 1950 },
                new PersonNode { Name = "Chú Hùng", Gender = "Nam", BirthYear = 1985 }
            },
            Steps = new List<StepInfo>
            {
                new StepInfo { RelType = "PARENT_OF", IsUp = true },
                new StepInfo { RelType = "PARENT_OF", IsUp = true },
                new StepInfo { RelType = "PARENT_OF", IsUp = false }
            }
        };
        AssertEquals("Chú", TranslatePathToTitle(pathChu), "Test 4: Chú");

        // Test 5: Cậu
        var pathCau = new PathResult
        {
            PersonA = new PersonNode { Name = "Cháu", Gender = "Nam", BirthYear = 2010 },
            PersonB = new PersonNode { Name = "Cậu Tuấn", Gender = "Nam", BirthYear = 1986 },
            Nodes = new List<PersonNode>
            {
                new PersonNode { Name = "Cháu", Gender = "Nam", BirthYear = 2010 },
                new PersonNode { Name = "Mẹ", Gender = "Nữ", BirthYear = 1982 },
                new PersonNode { Name = "Ông Ngoại", Gender = "Nam", BirthYear = 1950 },
                new PersonNode { Name = "Cậu Tuấn", Gender = "Nam", BirthYear = 1986 }
            },
            Steps = new List<StepInfo>
            {
                new StepInfo { RelType = "PARENT_OF", IsUp = true },
                new StepInfo { RelType = "PARENT_OF", IsUp = true },
                new StepInfo { RelType = "PARENT_OF", IsUp = false }
            }
        };
        AssertEquals("Cậu", TranslatePathToTitle(pathCau), "Test 5: Cậu");

        Console.WriteLine("✅ MỌI TEST KINSHIP SELF-TEST ĐÃ THÀNH CÔNG!");
    }

    private static void AssertEquals(string expected, string actual, string testName)
    {
        if (expected != actual)
        {
            throw new Exception($"[FAIL] {testName}: Đợi '{expected}', nhưng nhận được '{actual}'");
        }
        Console.WriteLine($"[PASS] {testName} => '{actual}'");
    }
}
