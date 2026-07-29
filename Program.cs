using BaiTapNeo4j;

if (args.Length > 0 && args[0].Equals("--selftest", StringComparison.OrdinalIgnoreCase))
{
    Kinship.SelfTest();
    return;
}

var builder = WebApplication.CreateBuilder(args);

var neo4jSection = builder.Configuration.GetSection("Neo4j");
var uri = neo4jSection["Uri"] ?? Neo4jRepo.DefaultUri;
var user = neo4jSection["User"] ?? Neo4jRepo.DefaultUser;
var password = neo4jSection["Password"] ?? Neo4jRepo.DefaultPassword;
var database = neo4jSection["Database"] ?? Neo4jRepo.DefaultDatabase;

builder.Services.AddSingleton(new Neo4jRepo(uri, user, password, database));

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

try
{
    var repo = app.Services.GetRequiredService<Neo4jRepo>();
    await repo.InitConstraintAsync();
    await repo.SeedDefaultRelationTypesAsync();
}
catch (Exception ex)
{
    app.Logger.LogWarning("Không thể kết nối Neo4j lúc khởi động: {Message}", ex.Message);
}

app.MapGet("/api/persons", async (Neo4jRepo repo, string? search) =>
{
    try
    {
        return Results.Ok(await repo.GetAllPersonsAsync(search ?? ""));
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapPost("/api/persons", async (Neo4jRepo repo, PersonNode person) =>
{
    if (string.IsNullOrWhiteSpace(person.Name))
        return Results.BadRequest(new { message = "Họ và tên không được để trống." });

    try
    {
        person.Id = Guid.NewGuid().ToString();
        await repo.CreatePersonAsync(person);
        return Results.Ok(person);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapPut("/api/persons/{id}", async (Neo4jRepo repo, string id, PersonNode person) =>
{
    if (string.IsNullOrWhiteSpace(person.Name))
        return Results.BadRequest(new { message = "Họ và tên không được để trống." });

    try
    {
        person.Id = id;
        await repo.UpdatePersonAsync(person);
        return Results.Ok(person);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapDelete("/api/persons/{id}", async (Neo4jRepo repo, string id) =>
{
    try
    {
        await repo.DeletePersonAsync(id);
        return Results.NoContent();
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapGet("/api/relationships", async (Neo4jRepo repo) =>
{
    try
    {
        return Results.Ok(await repo.GetAllRelationshipsAsync());
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapPost("/api/relationships", async (Neo4jRepo repo, CreateRelationshipRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.FromId) || string.IsNullOrWhiteSpace(req.ToId))
        return Results.BadRequest(new { message = "Vui lòng chọn đầy đủ hai người." });

    if (req.FromId == req.ToId)
        return Results.BadRequest(new { message = "Một người không thể tự tạo mối quan hệ với chính mình." });

    try
    {
        await repo.CreateRelationshipAsync(req.FromId, req.ToId, req.RelType);
        return Results.Ok(new { success = true });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapGet("/api/relation-types", async (Neo4jRepo repo) =>
{
    try
    {
        return Results.Ok(await repo.GetAllRelationTypesAsync());
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapPost("/api/relation-types", async (Neo4jRepo repo, RelationType type) =>
{
    if (string.IsNullOrWhiteSpace(type.Label))
        return Results.BadRequest(new { message = "Vui lòng nhập tên hiển thị cho loại quan hệ." });

    try
    {
        await repo.CreateRelationTypeAsync(type);
        return Results.Ok(type);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapDelete("/api/relation-types/{code}", async (Neo4jRepo repo, string code) =>
{
    try
    {
        await repo.DeleteRelationTypeAsync(code);
        return Results.NoContent();
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapDelete("/api/relationships", async (Neo4jRepo repo, string fromId, string toId, string relType) =>
{
    try
    {
        await repo.DeleteRelationshipAsync(fromId, toId, relType);
        return Results.NoContent();
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.MapGet("/api/kinship", async (Neo4jRepo repo, string fromId, string toId) =>
{
    if (string.IsNullOrWhiteSpace(fromId) || string.IsNullOrWhiteSpace(toId))
        return Results.BadRequest(new { message = "Vui lòng chọn Người A và Người B." });

    try
    {
        if (fromId == toId)
            return Results.Ok(new { title = "Đây là cùng 1 người", pathDescription = "", stepCount = 0 });

        var pathResult = await repo.FindShortestPathAsync(fromId, toId);
        if (pathResult == null || pathResult.Nodes.Count < 2)
            return Results.Ok(new { title = (string?)null, pathDescription = (string?)null, stepCount = 0, nodes = Array.Empty<PersonNode>() });

        var title = Kinship.TranslatePathToTitle(pathResult);
        var pathDescription = Kinship.FormatPathDescription(pathResult);
        var upCount = Kinship.CountUp(pathResult);
        var downCount = Kinship.CountDown(pathResult);

        return Results.Ok(new
        {
            title,
            pathDescription,
            stepCount = pathResult.Steps.Count,
            generationGap = Math.Max(upCount, downCount),
            upCount,
            downCount,
            nodes = pathResult.Nodes,
            steps = pathResult.Steps
        });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 502, title: "Lỗi kết nối Neo4j");
    }
});

app.Run();

record CreateRelationshipRequest(string FromId, string ToId, string RelType);
