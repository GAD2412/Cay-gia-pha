// =============================================================
// SCRIPT TAO DU LIEU MAU GIA PHA 3 THE HE HOAN CHINH (17 NODES)
// Copy va paste toan bo script nay vao Neo4j Browser de chay
// =============================================================

// 1. Tao Unique Constraint cho ID
CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;

// 2. Clear du lieu cu (Neu can)
// MATCH (n:Person) DETACH DELETE n;

// 3. Tao Nodes The he 1 (Ong / Ba)
CREATE (ongNoi:Person {id: 'P01', fullName: 'Nguyễn Văn An', gender: 'Nam', birthYear: 1945, birthPlace: 'Hà Nội', note: 'Ông Nội'})
CREATE (baNoi:Person {id: 'P02', fullName: 'Trần Thị Bình', gender: 'Nữ', birthYear: 1948, birthPlace: 'Hà Nội', note: 'Bà Nội'})
CREATE (ongNgoai:Person {id: 'P03', fullName: 'Lê Văn Cường', gender: 'Nam', birthYear: 1946, birthPlace: 'Nam Định', note: 'Ông Ngoại'})
CREATE (baNgoai:Person {id: 'P04', fullName: 'Phạm Thị Duyên', gender: 'Nữ', birthYear: 1949, birthPlace: 'Nam Định', note: 'Bà Ngoại'})

// 4. Tao Nodes The he 2 (Bo, Me, Bac, Chu, Co, Cau, Di)
CREATE (bacDung:Person {id: 'P05', fullName: 'Nguyễn Văn Dũng', gender: 'Nam', birthYear: 1970, birthPlace: 'Hà Nội', note: 'Bác ruột (anh Bố)'})
CREATE (bacThu:Person {id: 'P06', fullName: 'Hoàng Thị Thu', gender: 'Nữ', birthYear: 1972, birthPlace: 'Hải Phòng', note: 'Bác gái (vợ bác Dũng)'})
CREATE (boHai:Person {id: 'P07', fullName: 'Nguyễn Văn Hải', gender: 'Nam', birthYear: 1975, birthPlace: 'Hà Nội', note: 'Bố'})
CREATE (chuHung:Person {id: 'P08', fullName: 'Nguyễn Văn Hùng', gender: 'Nam', birthYear: 1978, birthPlace: 'Hà Nội', note: 'Chú (em trai Bố)'})
CREATE (coMai:Person {id: 'P09', fullName: 'Nguyễn Thị Mai', gender: 'Nữ', birthYear: 1980, birthPlace: 'Hà Nội', note: 'Cô (em gái Bố)'})

CREATE (bacHuong:Person {id: 'P10', fullName: 'Lê Thị Hương', gender: 'Nữ', birthYear: 1973, birthPlace: 'Nam Định', note: 'Bác Ngoại (chị Mẹ)'})
CREATE (meHoa:Person {id: 'P11', fullName: 'Lê Thị Hoa', gender: 'Nữ', birthYear: 1977, birthPlace: 'Nam Định', note: 'Mẹ'})
CREATE (cauTuan:Person {id: 'P12', fullName: 'Lê Văn Tuấn', gender: 'Nam', birthYear: 1982, birthPlace: 'Nam Định', note: 'Cậu (em trai Mẹ)'})
CREATE (diYen:Person {id: 'P13', fullName: 'Lê Thị Yến', gender: 'Nữ', birthYear: 1985, birthPlace: 'Nam Định', note: 'Dì (em gái Mẹ)'})

// 5. Tao Nodes The he 3 (Toi, Em gai, Anh/Chi em ho)
CREATE (toiMinh:Person {id: 'P14', fullName: 'Nguyễn Văn Minh', gender: 'Nam', birthYear: 2002, birthPlace: 'Hà Nội', note: 'Tôi (Nhân vật chính)'})
CREATE (emPhuong:Person {id: 'P15', fullName: 'Nguyễn Thị Phương', gender: 'Nữ', birthYear: 2006, birthPlace: 'Hà Nội', note: 'Em gái ruột'})
CREATE (anhNam:Person {id: 'P16', fullName: 'Nguyễn Văn Nam', gender: 'Nam', birthYear: 1998, birthPlace: 'Hà Nội', note: 'Anh họ (con bác Dũng)'})
CREATE (chiTrang:Person {id: 'P17', fullName: 'Nguyễn Thị Trang', gender: 'Nữ', birthYear: 2000, birthPlace: 'Hà Nội', note: 'Chị họ (con bác Dũng)'})

// 6. Quan he Hon nhan (MARRIED_TO)
CREATE (ongNoi)-[:MARRIED_TO {since: 1968}]->(baNoi)
CREATE (ongNgoai)-[:MARRIED_TO {since: 1970}]->(baNgoai)
CREATE (bacDung)-[:MARRIED_TO {since: 1996}]->(bacThu)
CREATE (boHai)-[:MARRIED_TO {since: 1999}]->(meHoa)

// 7. Quan he Cha Me -> Con (PARENT_OF)
// Nhanh Noi
CREATE (ongNoi)-[:PARENT_OF]->(bacDung)
CREATE (baNoi)-[:PARENT_OF]->(bacDung)
CREATE (ongNoi)-[:PARENT_OF]->(boHai)
CREATE (baNoi)-[:PARENT_OF]->(boHai)
CREATE (ongNoi)-[:PARENT_OF]->(chuHung)
CREATE (baNoi)-[:PARENT_OF]->(chuHung)
CREATE (ongNoi)-[:PARENT_OF]->(coMai)
CREATE (baNoi)-[:PARENT_OF]->(coMai)

// Nhanh Ngoai
CREATE (ongNgoai)-[:PARENT_OF]->(bacHuong)
CREATE (baNgoai)-[:PARENT_OF]->(bacHuong)
CREATE (ongNgoai)-[:PARENT_OF]->(meHoa)
CREATE (baNgoai)-[:PARENT_OF]->(meHoa)
CREATE (ongNgoai)-[:PARENT_OF]->(cauTuan)
CREATE (baNgoai)-[:PARENT_OF]->(cauTuan)
CREATE (ongNgoai)-[:PARENT_OF]->(diYen)
CREATE (baNgoai)-[:PARENT_OF]->(diYen)

// The he 2 -> The he 3
CREATE (boHai)-[:PARENT_OF]->(toiMinh)
CREATE (meHoa)-[:PARENT_OF]->(toiMinh)
CREATE (boHai)-[:PARENT_OF]->(emPhuong)
CREATE (meHoa)-[:PARENT_OF]->(emPhuong)

CREATE (bacDung)-[:PARENT_OF]->(anhNam)
CREATE (bacThu)-[:PARENT_OF]->(anhNam)
CREATE (bacDung)-[:PARENT_OF]->(chiTrang)
CREATE (bacThu)-[:PARENT_OF]->(chiTrang);
