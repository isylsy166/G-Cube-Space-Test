package test.gcube;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import test.gcube.support.MySqlTestContainer;

@SpringBootTest
@Import(MySqlTestContainer.class)
class GcubeTestApplicationTests {

    @Test
    void contextLoads() {
    }

}
