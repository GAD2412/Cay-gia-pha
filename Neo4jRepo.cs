using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Neo4j.Driver;

namespace BaiTapNeo4j;

public class RelationType
{
    public string Code { get; set; } = "";
    public string Label { get; set; } = "";
}

public class RelationshipViewDto
{
    public string FromId { get; set; } = "";
    public string FromName { get; set; } = "";
    public string RelType { get; set; } = "";
    public string ToId { get; set; } = "";
    public string ToName { get; set; } = "";

    public string DisplayText => $"{FromName}  --[{RelType}]-->  {ToName}";
}

public class Neo4jRepo : IAsyncDisposable
{
    // Cấu hình kết nối mặc định
    public const string DefaultUri = "neo4j://127.0.0.1:7687";
    public const string DefaultUser = "neo4j";
    public const string DefaultPassword = "12345678";
    public const string DefaultDatabase = "neo4j";

    private readonly IDriver _driver;
    private readonly string? _databaseName;

    public string CurrentUri { get; }
    public string CurrentUser { get; }
    public string CurrentPassword { get; }
    public string CurrentDatabase { get; }

    public Neo4jRepo(string uri = DefaultUri, string user = DefaultUser, string password = DefaultPassword, string? databaseName = DefaultDatabase)
    {
        CurrentUri = uri;
        CurrentUser = user;
        CurrentPassword = password;
        CurrentDatabase = databaseName ?? "";

        _driver = GraphDatabase.Driver(uri, AuthTokens.Basic(user, password));
        _databaseName = string.IsNullOrWhiteSpace(databaseName) ? null : databaseName;
    }

    private Action<SessionConfigBuilder> SessionOptions => builder =>
    {
        if (!string.IsNullOrWhiteSpace(_databaseName))
        {
            builder.WithDatabase(_databaseName);
        }
    };

    public static async Task TestConnectionAsync(string uri, string user, string password, string? dbName)
    {
        using var tempDriver = GraphDatabase.Driver(uri, AuthTokens.Basic(user, password));
        Action<SessionConfigBuilder> sessionOpts = builder =>
        {
            if (!string.IsNullOrWhiteSpace(dbName))
                builder.WithDatabase(dbName);
        };

        await using var session = tempDriver.AsyncSession(sessionOpts);
        var cursor = await session.RunAsync("RETURN 1 AS test");
        await cursor.FetchAsync();
    }

    public async Task InitConstraintAsync()
    {
        await using var session = _driver.AsyncSession(SessionOptions);
        await session.ExecuteWriteAsync(async tx =>
        {
            await tx.RunAsync("CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;");
        });
    }

    public async Task<List<PersonNode>> GetAllPersonsAsync(string searchName = "")
    {
        await using var session = _driver.AsyncSession(SessionOptions);
        return await session.ExecuteReadAsync(async tx =>
        {
            var query = @"
                MATCH (p:Person)
                WHERE $searchName = '' OR toLower(coalesce(p.name, p.fullName, '')) CONTAINS toLower($searchName)
                RETURN p.id AS id, 
                       coalesce(p.name, p.fullName, '') AS name, 
                       coalesce(p.gender, 'Nam') AS gender, 
                       coalesce(p.birthYear, 2000) AS birthYear, 
                       coalesce(p.birthPlace, '') AS birthPlace, 
                       coalesce(p.occupation, '') AS occupation,
                       coalesce(p.note, '') AS note,
                       coalesce(p.cccd, '') AS cccd,
                       coalesce(p.phoneNumber, '') AS phoneNumber
                ORDER BY name";

            var cursor = await tx.RunAsync(query, new { searchName });
            var list = new List<PersonNode>();

            while (await cursor.FetchAsync())
            {
                var rec = cursor.Current;
                list.Add(new PersonNode
                {
                    Id = rec["id"].As<string>(),
                    Name = rec["name"].As<string>(),
                    Gender = rec["gender"]?.As<string>() ?? "Nam",
                    BirthYear = rec["birthYear"] != null ? Convert.ToInt32(rec["birthYear"]) : 2000,
                    BirthPlace = rec["birthPlace"]?.As<string>() ?? "",
                    Occupation = rec["occupation"]?.As<string>() ?? "",
                    Note = rec["note"]?.As<string>() ?? "",
                    CCCD = rec["cccd"]?.As<string>() ?? "",
                    PhoneNumber = rec["phoneNumber"]?.As<string>() ?? ""
                });
            }

            return list;
        });
    }

    public async Task CreatePersonAsync(PersonNode person)
    {
        if (string.IsNullOrWhiteSpace(person.Id))
            person.Id = Guid.NewGuid().ToString();

        await using var session = _driver.AsyncSession(SessionOptions);
        await session.ExecuteWriteAsync(async tx =>
        {
            var query = @"
                CREATE (p:Person {
                    id: $id,
                    name: $name,
                    fullName: $name,
                    gender: $gender,
                    birthYear: $birthYear,
                    birthPlace: $birthPlace,
                    occupation: $occupation,
                    note: $note,
                    cccd: $cccd,
                    phoneNumber: $phoneNumber
                })";

            await tx.RunAsync(query, new
            {
                id = person.Id,
                name = person.Name,
                gender = person.Gender,
                birthYear = person.BirthYear,
                birthPlace = person.BirthPlace ?? "",
                occupation = person.Occupation ?? "",
                note = person.Note ?? "",
                cccd = person.CCCD ?? "",
                phoneNumber = person.PhoneNumber ?? ""
            });
        });
    }

    public async Task UpdatePersonAsync(PersonNode person)
    {
        await using var session = _driver.AsyncSession(SessionOptions);
        await session.ExecuteWriteAsync(async tx =>
        {
            var query = @"
                MATCH (p:Person {id: $id})
                SET p.name = $name,
                    p.fullName = $name,
                    p.gender = $gender,
                    p.birthYear = $birthYear,
                    p.birthPlace = $birthPlace,
                    p.occupation = $occupation,
                    p.note = $note,
                    p.cccd = $cccd,
                    p.phoneNumber = $phoneNumber";

            await tx.RunAsync(query, new
            {
                id = person.Id,
                name = person.Name,
                gender = person.Gender,
                birthYear = person.BirthYear,
                birthPlace = person.BirthPlace ?? "",
                occupation = person.Occupation ?? "",
                note = person.Note ?? "",
                cccd = person.CCCD ?? "",
                phoneNumber = person.PhoneNumber ?? ""
            });
        });
    }

    public async Task DeletePersonAsync(string id)
    {
        await using var session = _driver.AsyncSession(SessionOptions);
        await session.ExecuteWriteAsync(async tx =>
        {
            var query = "MATCH (p:Person {id: $id}) DETACH DELETE p";
            await tx.RunAsync(query, new { id });
        });
    }

    private static readonly System.Text.RegularExpressions.Regex RelTypeCodePattern =
        new(@"^[A-Z][A-Z0-9_]{1,40}$");

    public async Task<List<RelationType>> GetAllRelationTypesAsync()
    {
        await using var session = _driver.AsyncSession(SessionOptions);
        return await session.ExecuteReadAsync(async tx =>
        {
            var cursor = await tx.RunAsync(
                "MATCH (rt:RelationType) RETURN rt.code AS code, rt.label AS label ORDER BY rt.label");
            var list = new List<RelationType>();
            while (await cursor.FetchAsync())
            {
                var rec = cursor.Current;
                list.Add(new RelationType { Code = rec["code"].As<string>(), Label = rec["label"].As<string>() });
            }
            return list;
        });
    }

    public async Task CreateRelationTypeAsync(RelationType type)
    {
        if (!RelTypeCodePattern.IsMatch(type.Code))
            throw new ArgumentException("Mã loại quan hệ chỉ được chứa chữ hoa, số, gạch dưới, bắt đầu bằng chữ cái (VD: ANH_EM_KET_NGHIA).");

        await using var session = _driver.AsyncSession(SessionOptions);
        await session.ExecuteWriteAsync(async tx =>
        {
            await tx.RunAsync(
                "MERGE (rt:RelationType {code: $code}) SET rt.label = $label",
                new { code = type.Code, label = type.Label });
        });
    }

    public async Task DeleteRelationTypeAsync(string code)
    {
        await using var session = _driver.AsyncSession(SessionOptions);
        await session.ExecuteWriteAsync(async tx =>
        {
            await tx.RunAsync("MATCH (rt:RelationType {code: $code}) DELETE rt", new { code });
        });
    }

    public async Task SeedDefaultRelationTypesAsync()
    {
        var defaults = new (string Code, string Label)[]
        {
            ("PARENT_OF", "Cha/Mẹ của"),
            ("MARRIED_TO", "Kết hôn với"),
            ("ADOPTED_PARENT_OF", "Cha/Mẹ nuôi của"),
            ("DIVORCED_FROM", "Ly hôn với"),
        };

        await using var session = _driver.AsyncSession(SessionOptions);
        await session.ExecuteWriteAsync(async tx =>
        {
            foreach (var (code, label) in defaults)
            {
                await tx.RunAsync(
                    "MERGE (rt:RelationType {code: $code}) ON CREATE SET rt.label = $label",
                    new { code, label });
            }
        });
    }

    public async Task CreateRelationshipAsync(string fromId, string toId, string relType, int year = 0)
    {
        var existingTypes = (await GetAllRelationTypesAsync()).Select(t => t.Code).ToHashSet();
        if (!existingTypes.Contains(relType) || !RelTypeCodePattern.IsMatch(relType))
            throw new ArgumentException($"Loại quan hệ không hợp lệ: {relType}");

        await using var session = _driver.AsyncSession(SessionOptions);
        await session.ExecuteWriteAsync(async tx =>
        {
            string cypher = $@"
                MATCH (a:Person {{id: $fromId}}), (b:Person {{id: $toId}})
                MERGE (a)-[r:{relType}]->(b)";

            await tx.RunAsync(cypher, new { fromId, toId, year });
        });
    }

    public async Task DeleteRelationshipAsync(string fromId, string toId, string relType)
    {
        await using var session = _driver.AsyncSession(SessionOptions);
        await session.ExecuteWriteAsync(async tx =>
        {
            var cypher = @"
                MATCH (a:Person {id: $fromId})-[r]->(b:Person {id: $toId})
                WHERE type(r) = $relType
                DELETE r";

            await tx.RunAsync(cypher, new { fromId, toId, relType });
        });
    }

    public async Task<List<RelationshipViewDto>> GetAllRelationshipsAsync()
    {
        await using var session = _driver.AsyncSession(SessionOptions);
        return await session.ExecuteReadAsync(async tx =>
        {
            var cypher = @"
                MATCH (a:Person)-[r]->(b:Person)
                RETURN a.id AS fromId, coalesce(a.name, a.fullName, '') AS fromName, 
                       type(r) AS relType, 
                       b.id AS toId, coalesce(b.name, b.fullName, '') AS toName
                ORDER BY fromName";

            var cursor = await tx.RunAsync(cypher);
            var list = new List<RelationshipViewDto>();

            while (await cursor.FetchAsync())
            {
                var rec = cursor.Current;
                list.Add(new RelationshipViewDto
                {
                    FromId = rec["fromId"].As<string>(),
                    FromName = rec["fromName"].As<string>(),
                    RelType = rec["relType"].As<string>(),
                    ToId = rec["toId"].As<string>(),
                    ToName = rec["toName"].As<string>()
                });
            }

            return list;
        });
    }

    public async Task<PathResult?> FindShortestPathAsync(string fromId, string toId)
    {
        await using var session = _driver.AsyncSession(SessionOptions);
        return await session.ExecuteReadAsync(async tx =>
        {
            var cypher = @"
                MATCH (a:Person {id: $fromId}), (b:Person {id: $toId})
                MATCH p = shortestPath((a)-[:PARENT_OF|ADOPTED_PARENT_OF|MARRIED_TO|DIVORCED_FROM*1..6]-(b))
                RETURN 
                  [r IN relationships(p) | {
                    type: type(r),
                    startId: startNode(r).id,
                    endId: endNode(r).id
                  }] AS rels,
                  [n IN nodes(p) | {
                    id: n.id,
                    name: coalesce(n.name, n.fullName, ''),
                    gender: coalesce(n.gender, 'Nam'),
                    birthYear: coalesce(n.birthYear, 2000),
                    birthPlace: coalesce(n.birthPlace, ''),
                    occupation: coalesce(n.occupation, ''),
                    note: coalesce(n.note, ''),
                    cccd: coalesce(n.cccd, ''),
                    phoneNumber: coalesce(n.phoneNumber, '')
                  }] AS nodes";

            var cursor = await tx.RunAsync(cypher, new { fromId, toId });
            if (!await cursor.FetchAsync()) return null;

            var rec = cursor.Current;
            var nodesRaw = rec["nodes"].As<List<object>>();
            var relsRaw = rec["rels"].As<List<object>>();

            var nodeList = new List<PersonNode>();
            foreach (var nObj in nodesRaw)
            {
                var dict = (IDictionary<string, object>)nObj;
                nodeList.Add(new PersonNode
                {
                    Id = dict["id"].ToString() ?? "",
                    Name = dict["name"].ToString() ?? "",
                    Gender = dict["gender"].ToString() ?? "Nam",
                    BirthYear = dict["birthYear"] != null ? Convert.ToInt32(dict["birthYear"]) : 2000,
                    BirthPlace = dict["birthPlace"].ToString() ?? "",
                    Occupation = dict["occupation"].ToString() ?? "",
                    Note = dict["note"].ToString() ?? "",
                    CCCD = dict["cccd"].ToString() ?? "",
                    PhoneNumber = dict["phoneNumber"].ToString() ?? ""
                });
            }

            var stepsList = new List<StepInfo>();
            for (int i = 0; i < relsRaw.Count; i++)
            {
                var dict = (IDictionary<string, object>)relsRaw[i];
                string type = dict["type"].ToString() ?? "";
                string startId = dict["startId"].ToString() ?? "";

                var nextNodeId = nodeList[i + 1].Id;
                bool isUp = ((type == "PARENT_OF" || type == "ADOPTED_PARENT_OF") && startId == nextNodeId);

                stepsList.Add(new StepInfo
                {
                    RelType = type,
                    IsUp = isUp
                });
            }

            return new PathResult
            {
                PersonA = nodeList.First(),
                PersonB = nodeList.Last(),
                Nodes = nodeList,
                Steps = stepsList
            };
        });
    }

    public ValueTask DisposeAsync()
    {
        return _driver.DisposeAsync();
    }
}
